// GET /api/diwali/state: public guest list with each guest's potluck dishes, plus this device's own RSVP.
import { route, loadDishes, loadRsvps, guestToken, sha, shortName } from './_lib.js';

export default route(['GET'], async (req) => {
  const token = guestToken(req);
  const th = token ? sha(token) : null;
  const [rsvps, dishes] = await Promise.all([loadRsvps(), loadDishes()]);

  const byRsvp = {};
  for (const d of dishes) (byRsvp[d.rsvpId] ||= []).push(d);

  const counts = { going: { parties: 0, adults: 0, kids: 0 }, maybe: { parties: 0, adults: 0, kids: 0 }, no: { parties: 0 } };
  const guests = [];
  let me = null;
  for (const r of rsvps) {
    const c = counts[r.status];
    if (c) {
      c.parties++;
      if (r.status !== 'no') { c.adults += r.adults; c.kids += r.kids; }
    }
    const mine = !!th && r.th === th;
    const myDishes = (byRsvp[r.id] || []).map((d) => ({ id: d.id, type: d.type, item: d.item }));
    if (r.status !== 'no') guests.push({ name: shortName(r.name), status: r.status, adults: r.adults, kids: r.kids, mine, dishes: myDishes });
    if (mine) me = { name: r.name, status: r.status, adults: r.adults, kids: r.kids, diet: r.diet, note: r.note, dishes: myDishes };
  }
  return { me, counts, guests };
});
