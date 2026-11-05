// POST /api/diwali/potluck: open on purpose. Anyone with the link can add, edit or remove
// dishes under any guest who RSVP'd Going or Maybe (spouses often do it for each other).
//   { action: "add",    rsvpId, type, item }
//   { action: "update", id, type, item }
//   { action: "remove", id }
import { route, readBody, text, honeypot, rateLimit, redis, K, parse, newId, HttpError } from './_lib.js';

const MAX_PER_GUEST = 6;
const ID = /^[A-Za-z0-9]{1,20}$/;

function id(v, what) {
  if (typeof v !== 'string' || !ID.test(v)) throw new HttpError(400, `Unknown ${what}.`);
  return v;
}

export default route(['POST'], async (req) => {
  const body = await readBody(req);
  if (honeypot(body)) return { fake: true };
  await rateLimit(req, 'potluck', 60, 600);
  const action = body.action;

  if (action === 'add') {
    const rsvpId = id(body.rsvpId, 'guest');
    const type = text(body.type, { max: 30, required: true, label: 'Dish type' });
    const item = text(body.item, { max: 80, required: true, label: 'Food item' });
    const r = parse(await redis('HGET', K.rsvps, rsvpId));
    if (!r) throw new HttpError(404, 'We couldn’t find that guest. The list has been refreshed.', { code: 'STALE' });
    if (r.status === 'no') throw new HttpError(400, `${r.name.split(/\s+/)[0]} said they can’t make it. Update the RSVP first.`, { code: 'STALE' });
    const all = ((await redis('HVALS', K.dishes)) || []).map(parse).filter((d) => d && d.rsvpId === rsvpId);
    if (all.length >= MAX_PER_GUEST) throw new HttpError(400, `That’s already ${MAX_PER_GUEST} dishes for this guest, thank you! That’s plenty.`);
    const dish = { id: newId(), rsvpId, type, item, ts: Date.now() };
    await redis('HSET', K.dishes, dish.id, JSON.stringify(dish));
    return { id: dish.id };
  }

  if (action === 'update') {
    const did = id(body.id, 'dish');
    const type = text(body.type, { max: 30, required: true, label: 'Dish type' });
    const item = text(body.item, { max: 80, required: true, label: 'Food item' });
    const d = parse(await redis('HGET', K.dishes, did));
    if (!d) throw new HttpError(404, 'That dish was already removed. The list has been refreshed.', { code: 'STALE' });
    await redis('HSET', K.dishes, did, JSON.stringify({ ...d, type, item }));
    return {};
  }

  if (action === 'remove') {
    await redis('HDEL', K.dishes, id(body.id, 'dish'));
    return {};
  }

  throw new HttpError(400, 'Unknown action.');
});
