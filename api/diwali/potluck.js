// POST /api/diwali/potluck: guest actions on the potluck.
//   { action: "claim",   catId, slot ("open" | number), name, dish }
//   { action: "release", catId, slot }
//   { action: "update",  catId, slot, name, dish }
//   { action: "addCategory", name, slots (0 = open-ended) }
import { route, readBody, text, int, honeypot, rateLimit, redis, lua, K, guestToken, newToken, newId, sha, catSlug, HttpError } from './_lib.js';
import { CLAIM, MINE } from './_lua.js';

const MAX_CATS = 30;

function catId(v) {
  if (typeof v !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v)) throw new HttpError(400, 'Unknown potluck category.');
  return v;
}
function slotKey(v) {
  const s = String(v ?? '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(s)) throw new HttpError(400, 'Unknown slot.');
  return s;
}

export default route(['POST'], async (req) => {
  const body = await readBody(req);
  if (honeypot(body)) return { token: newToken(), fake: true };
  await rateLimit(req, 'potluck', 40, 600);

  let token = guestToken(req);
  const action = body.action;

  if (action === 'claim') {
    const id = catId(body.catId);
    const slot = body.slot === 'open' ? 'open' : String(int(body.slot, { min: 1, max: 99, label: 'Slot' }));
    const name = text(body.name, { max: 60, required: true, label: 'Your name' });
    const dish = text(body.dish, { max: 80, required: true, label: 'Dish' });
    if (!token) token = newToken();
    const claim = JSON.stringify({ name, dish, th: sha(token), ts: Date.now() });
    const r = await lua(CLAIM, [K.cats, K.claims(id)], [id, slot, claim, 'o' + Date.now().toString(36) + newId(3)]);
    if (r === 'TAKEN') throw new HttpError(409, 'Someone just took that spot. Please pick another open one.', { code: 'TAKEN' });
    if (r === 'FULL') throw new HttpError(409, 'This category just filled up. Pick another category, or add your dish under Others.', { code: 'FULL' });
    if (r === 'NOCAT') throw new HttpError(404, 'That category no longer exists. The list has been refreshed.', { code: 'STALE' });
    if (r === 'BADSLOT') throw new HttpError(409, 'This category was just changed by the host. The list has been refreshed.', { code: 'STALE' });
    return { token, slot: String(r).slice(3) };
  }

  if (action === 'release' || action === 'update') {
    if (!token) throw new HttpError(403, 'We couldn’t confirm this is your dish. Open your private edit link on this device first.');
    const id = catId(body.catId);
    const slot = slotKey(body.slot);
    let dish = '', name = '';
    if (action === 'update') {
      name = text(body.name, { max: 60, required: true, label: 'Your name' });
      dish = text(body.dish, { max: 80, required: true, label: 'Dish' });
    }
    const r = await lua(MINE, [K.claims(id)], [slot, sha(token), action, dish, name]);
    if (r === 'GONE') throw new HttpError(404, 'That dish was already removed.', { code: 'STALE' });
    if (r === 'NOTYOURS') throw new HttpError(403, 'You can only change dishes you signed up for on this device.');
    return { token };
  }

  if (action === 'addCategory') {
    await rateLimit(req, 'newcat', 5, 3600);
    const name = text(body.name, { max: 30, required: true, label: 'Category name' });
    const slots = int(body.slots, { min: 0, max: 10, label: 'Number of spots', dflt: 0 });
    const existing = (await redis('HVALS', K.cats)) || [];
    if (existing.length >= MAX_CATS) throw new HttpError(400, 'There are already plenty of categories. Try Others instead.');
    const lower = name.toLowerCase();
    if (existing.some((j) => (JSON.parse(j).name || '').toLowerCase() === lower)) {
      throw new HttpError(409, `There’s already a “${name}” category. Pick a spot there instead.`);
    }
    const id = catSlug(name);
    const cat = { id, name, slots, order: 1000 + existing.length, byGuest: true, created: Date.now() };
    await redis('HSET', K.cats, id, JSON.stringify(cat));
    return { id };
  }

  throw new HttpError(400, 'Unknown action.');
});
