// POST /api/diwali/potluck: a guest who has RSVP'd (Going or Maybe) manages their own dishes.
//   { action: "add",    type, item }
//   { action: "update", id, type, item }
//   { action: "remove", id }
import { route, readBody, text, honeypot, rateLimit, redis, K, parse, guestToken, newId, rsvpForToken, HttpError } from './_lib.js';

const MAX_PER_GUEST = 6;

export default route(['POST'], async (req) => {
  const body = await readBody(req);
  if (honeypot(body)) return { fake: true };
  await rateLimit(req, 'potluck', 40, 600);

  const rsvp = await rsvpForToken(guestToken(req));
  if (!rsvp) throw new HttpError(403, 'Please RSVP first, then add what you’re bringing.', { code: 'NO_RSVP' });
  if (rsvp.status === 'no') throw new HttpError(403, 'Your RSVP says you can’t make it. Change it to Going or Maybe to add a dish.', { code: 'NO_RSVP' });

  const action = body.action;
  if (action === 'add' || action === 'update') {
    const type = text(body.type, { max: 30, required: true, label: 'Dish type' });
    const item = text(body.item, { max: 80, required: true, label: 'Food item' });
    if (action === 'add') {
      const all = (await redis('HVALS', K.dishes)) || [];
      const mine = all.map(parse).filter((d) => d && d.rsvpId === rsvp.id);
      if (mine.length >= MAX_PER_GUEST) throw new HttpError(400, `That’s already ${MAX_PER_GUEST} dishes, thank you! That’s plenty.`);
      const dish = { id: newId(), rsvpId: rsvp.id, type, item, ts: Date.now() };
      await redis('HSET', K.dishes, dish.id, JSON.stringify(dish));
      return { id: dish.id };
    }
    const id = dishId(body.id);
    const d = parse(await redis('HGET', K.dishes, id));
    if (!d) throw new HttpError(404, 'That dish was already removed.', { code: 'STALE' });
    if (d.rsvpId !== rsvp.id) throw new HttpError(403, 'You can only change your own dishes.');
    await redis('HSET', K.dishes, id, JSON.stringify({ ...d, type, item }));
    return {};
  }

  if (action === 'remove') {
    const id = dishId(body.id);
    const d = parse(await redis('HGET', K.dishes, id));
    if (!d) return {};
    if (d.rsvpId !== rsvp.id) throw new HttpError(403, 'You can only remove your own dishes.');
    await redis('HDEL', K.dishes, id);
    return {};
  }

  throw new HttpError(400, 'Unknown action.');
});

function dishId(v) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9]{1,20}$/.test(v)) throw new HttpError(400, 'Unknown dish.');
  return v;
}
