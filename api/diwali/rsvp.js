// POST /api/diwali/rsvp: create or update this device's RSVP (identified by the x-guest-token header).
import { route, readBody, text, int, honeypot, rateLimit, redis, pipeline, K, parse, guestToken, newToken, newId, sha, HttpError } from './_lib.js';

const STATUSES = ['going', 'maybe', 'no'];

export default route(['POST'], async (req) => {
  const body = await readBody(req);
  if (honeypot(body)) return { token: newToken(), fake: true };
  await rateLimit(req, 'rsvp', 20, 600);

  const name = text(body.name, { max: 60, required: true, label: 'Name' });
  if (!STATUSES.includes(body.status)) throw new HttpError(400, 'Please choose Going, Maybe or Can’t go.');
  const status = body.status;
  let adults = int(body.adults, { min: 0, max: 15, label: 'Adults', dflt: 1 });
  let kids = int(body.kids, { min: 0, max: 15, label: 'Kids', dflt: 0 });
  if (status === 'no') { adults = 0; kids = 0; }
  else if (adults + kids === 0) throw new HttpError(400, 'Please tell us how many people are coming (at least one).');
  const diet = text(body.diet, { max: 200, label: 'Dietary note' });
  const note = text(body.note, { max: 500, label: 'Note to the host', multiline: true });

  let token = guestToken(req);
  let existing = null;
  if (token) {
    const id = await redis('HGET', K.tok, sha(token));
    if (id) existing = parse(await redis('HGET', K.rsvps, id));
  } else {
    token = newToken();
  }

  const now = Date.now();
  const th = sha(token);
  const rsvp = existing
    ? { ...existing, name, status, adults, kids, diet, note, updated: now }
    : { id: newId(), name, status, adults, kids, diet, note, th, created: now, updated: now };

  await pipeline([
    ['HSET', K.rsvps, rsvp.id, JSON.stringify(rsvp)],
    ['HSET', K.tok, th, rsvp.id],
  ]);
  return { token, updated: !!existing, me: { name, status, adults, kids, diet, note } };
});
