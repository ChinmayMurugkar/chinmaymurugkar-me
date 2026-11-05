// GET /api/diwali/state: public view of the guest list and potluck, plus this device's own RSVP and claims.
import { route, ensureSeed, loadCats, loadRsvps, guestToken, sha, shortName } from './_lib.js';

export default route(['GET'], async (req) => {
  await ensureSeed();
  const token = guestToken(req);
  const th = token ? sha(token) : null;
  const [cats, rsvps] = await Promise.all([loadCats(), loadRsvps()]);

  const counts = { going: { parties: 0, adults: 0, kids: 0 }, maybe: { parties: 0, adults: 0, kids: 0 }, no: { parties: 0 } };
  const guests = [];
  let me = null;
  for (const r of rsvps) {
    const c = counts[r.status];
    if (c) {
      c.parties++;
      if (r.status !== 'no') { c.adults += r.adults; c.kids += r.kids; }
    }
    if (r.status !== 'no') guests.push({ name: shortName(r.name), status: r.status, adults: r.adults, kids: r.kids });
    if (th && r.th === th) me = { name: r.name, status: r.status, adults: r.adults, kids: r.kids, diet: r.diet, note: r.note };
  }

  return {
    me,
    counts,
    guests,
    cats: cats.map((c) => ({
      id: c.id,
      name: c.name,
      slots: c.slots,
      byGuest: !!c.byGuest,
      claims: c.claims.map((x) => ({ slot: x.slot, name: shortName(x.name), dish: x.dish, mine: !!th && x.th === th })),
    })),
  };
});
