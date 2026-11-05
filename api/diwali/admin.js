// /api/diwali/admin: host-only. Requires header x-admin-key matching DIWALI_ADMIN_KEY.
//   GET  -> everything (RSVPs with notes, categories with full claims)
//   POST { action, ... } -> see switch below
import { route, readBody, text, int, requireAdmin, rateLimit, redis, pipeline, lua, K, parse, ensureSeed, loadCats, loadRsvps, catSlug, HttpError } from './_lib.js';
import { SET_SLOTS, MERGE } from './_lua.js';

function catId(v) {
  if (typeof v !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v)) throw new HttpError(400, 'Unknown category.');
  return v;
}

async function getCat(id) {
  const c = parse(await redis('HGET', K.cats, id));
  if (!c) throw new HttpError(404, 'That category no longer exists.');
  return c;
}

export default route(['GET', 'POST'], async (req) => {
  await requireAdmin(req);
  await ensureSeed();

  if (req.method === 'GET') {
    const [cats, rsvps] = await Promise.all([loadCats(), loadRsvps()]);
    return {
      rsvps: rsvps.map(({ th, ...r }) => r),
      cats: cats.map((c) => ({ ...c, claims: c.claims.map(({ th, ...x }) => x) })),
    };
  }

  await rateLimit(req, 'admin', 200, 600);
  const b = await readBody(req);
  switch (b.action) {
    case 'addCategory': {
      const name = text(b.name, { max: 30, required: true, label: 'Category name' });
      const slots = int(b.slots, { min: 0, max: 50, label: 'Spots', dflt: 0 });
      const id = catSlug(name);
      const n = await redis('HLEN', K.cats);
      await redis('HSET', K.cats, id, JSON.stringify({ id, name, slots, order: n, byGuest: false, created: Date.now() }));
      return { id };
    }
    case 'renameCategory': {
      const id = catId(b.id);
      const name = text(b.name, { max: 30, required: true, label: 'Category name' });
      const c = await getCat(id);
      c.name = name;
      c.byGuest = false; // once the host has touched it, it's theirs
      await redis('HSET', K.cats, id, JSON.stringify(c));
      return {};
    }
    case 'setSlots': {
      const id = catId(b.id);
      const slots = int(b.slots, { min: 0, max: 50, label: 'Spots' });
      const r = await lua(SET_SLOTS, [K.cats, K.claims(id)], [id, slots]);
      if (r === 'NOCAT') throw new HttpError(404, 'That category no longer exists.');
      if (r === 'TOOMANY') throw new HttpError(409, 'More people have signed up than that. Free some spots first, or pick a bigger number.');
      return {};
    }
    case 'reorder': {
      if (!Array.isArray(b.ids) || b.ids.length > 100) throw new HttpError(400, 'Bad order.');
      const ids = b.ids.map(catId);
      const raws = await pipeline(ids.map((id) => ['HGET', K.cats, id]));
      const cmds = [];
      raws.forEach((raw, i) => {
        const c = parse(raw);
        if (c) { c.order = i; cmds.push(['HSET', K.cats, c.id, JSON.stringify(c)]); }
      });
      await pipeline(cmds);
      return {};
    }
    case 'deleteCategory': {
      const id = catId(b.id);
      await pipeline([['HDEL', K.cats, id], ['DEL', K.claims(id)]]);
      return {};
    }
    case 'mergeCategory': {
      const from = catId(b.from), to = catId(b.to);
      if (from === to) throw new HttpError(400, 'Pick two different categories.');
      const r = await lua(MERGE, [K.cats, K.claims(from), K.claims(to)], [from, to]);
      if (r === 'NOCAT') throw new HttpError(404, 'One of those categories no longer exists.');
      return {};
    }
    case 'freeSlot': {
      const id = catId(b.id);
      const slot = String(b.slot ?? '');
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(slot)) throw new HttpError(400, 'Unknown slot.');
      await redis('HDEL', K.claims(id), slot);
      return {};
    }
    case 'deleteRsvp': {
      const id = String(b.id ?? '');
      if (!/^[A-Za-z0-9]{1,20}$/.test(id)) throw new HttpError(400, 'Unknown RSVP.');
      const r = parse(await redis('HGET', K.rsvps, id));
      if (!r) throw new HttpError(404, 'That RSVP was already removed.');
      await pipeline([['HDEL', K.rsvps, id], ['HDEL', K.tok, r.th]]);
      return {};
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
});
