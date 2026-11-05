// /api/diwali/admin: host-only. Requires header x-admin-key matching DIWALI_ADMIN_KEY.
//   GET  -> all RSVPs (with notes) and all dishes
//   POST { action: "deleteRsvp", id } | { action: "deleteDish", id }
import { route, readBody, requireAdmin, rateLimit, redis, pipeline, K, parse, loadRsvps, loadDishes, HttpError } from './_lib.js';

const ID = /^[A-Za-z0-9]{1,20}$/;

export default route(['GET', 'POST'], async (req) => {
  await requireAdmin(req);

  if (req.method === 'GET') {
    const [rsvps, dishes] = await Promise.all([loadRsvps(), loadDishes()]);
    return { rsvps: rsvps.map(({ th, ...r }) => r), dishes };
  }

  await rateLimit(req, 'admin', 200, 600);
  const b = await readBody(req);
  const id = String(b.id ?? '');
  if (!ID.test(id)) throw new HttpError(400, 'Unknown id.');

  if (b.action === 'deleteRsvp') {
    const r = parse(await redis('HGET', K.rsvps, id));
    if (!r) throw new HttpError(404, 'That RSVP was already removed.');
    const dishes = (await loadDishes()).filter((d) => d.rsvpId === id);
    await pipeline([['HDEL', K.rsvps, id], ['HDEL', K.tok, r.th], ...dishes.map((d) => ['HDEL', K.dishes, d.id])]);
    return { removedDishes: dishes.length };
  }
  if (b.action === 'deleteDish') {
    await redis('HDEL', K.dishes, id);
    return {};
  }
  throw new HttpError(400, 'Unknown action.');
});
