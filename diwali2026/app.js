(() => {
  'use strict';

  // ---------- event facts ----------
  const EVENT = {
    title: 'Diwali Party 2026',
    start: new Date('2026-11-06T18:00:00-08:00'),
    end: new Date('2026-11-06T22:00:00-08:00'),
    location: '467 Minnesota Avenue, San Jose, CA',
    details: 'Diwali celebration hosted by Chinmay, Isha & Shriyan Murugkar. Dress: traditional, deck up! RSVP & potluck: https://www.chinmaymurugkar.com/diwali2026',
    url: 'https://www.chinmaymurugkar.com/diwali2026',
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  // ---------- storage (never trust it to exist) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
  let token = store.get('dw26_token');
  // Private edit link: ?me=<token>
  const params = new URLSearchParams(location.search);
  const linkToken = params.get('me');
  if (linkToken && TOKEN_RE.test(linkToken)) {
    token = linkToken;
    store.set('dw26_token', token);
    params.delete('me');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }
  if (token && !TOKEN_RE.test(token)) token = null;
  const setToken = (t) => { if (t && TOKEN_RE.test(t)) { token = t; store.set('dw26_token', t); } };
  const editUrl = () => token ? EVENT.url + '?me=' + encodeURIComponent(token) : '';

  // ---------- tiny DOM helper (text only, never innerHTML) ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }

  // ---------- API ----------
  async function api(path, body) {
    const opts = { headers: {} };
    if (token) opts.headers['x-guest-token'] = token;
    if (body) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res, data;
    try {
      res = await fetch('/api/diwali/' + path, opts);
      data = await res.json();
    } catch {
      throw Object.assign(new Error('Couldn’t reach the server. Check your connection and try again.'), { code: 'NET' });
    }
    if (!data.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { code: data.code, status: res.status });
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = h('textarea', { value: text, style: 'position:fixed;opacity:0' });
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove(); return ok;
    }
  }

  // ---------- rangoli ----------
  (function rangoli() {
    const svg = $('rangoli');
    const NS = 'http://www.w3.org/2000/svg';
    const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
    const rings = [
      { n: 16, r: 88, len: 14, w: 7, c: '#f6c453' },
      { n: 12, r: 66, len: 20, w: 10, c: '#e8457a' },
      { n: 8, r: 42, len: 22, w: 13, c: '#f28c18' },
      { n: 8, r: 20, len: 16, w: 9, c: '#19a59a' },
    ];
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.n; i++) {
        const a = (360 / ring.n) * i + (ri % 2 ? 180 / ring.n : 0);
        const y = -ring.r;
        add('path', {
          d: `M0 ${y + ring.len} Q ${ring.w} ${y} 0 ${y - ring.len} Q ${-ring.w} ${y} 0 ${y + ring.len}Z`,
          fill: ring.c, transform: `rotate(${a})`,
        });
      }
      add('circle', { r: ring.r - ring.len - 4, fill: 'none', stroke: '#fff3dc', 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: .7 });
    });
    for (let i = 0; i < 24; i++) add('circle', { r: 2.4, cx: 0, cy: -98, fill: '#fff3dc', transform: `rotate(${i * 15})` });
    add('circle', { r: 7, fill: '#f6c453' });
  })();

  // ---------- sparkles & fireworks ----------
  (function sky() {
    if (reduceMotion) return;
    const c = $('sky'), ctx = c.getContext('2d');
    let W, H, dpr, sparks = [], bursts = [], raf = 0, nextBurst = 0;
    const COLORS = ['#f6c453', '#ffdf8a', '#f28c18', '#e8457a', '#fff3dc', '#7fe3d6'];
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr;
      sparks = Array.from({ length: Math.round(Math.min(70, innerWidth / 8)) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + .4) * dpr,
        p: Math.random() * Math.PI * 2, s: Math.random() * .02 + .008, vy: (Math.random() * .15 + .05) * dpr,
      }));
    }
    function burst(t) {
      const x = W * (.15 + Math.random() * .7), y = H * (.08 + Math.random() * .3);
      const col = COLORS[(Math.random() * COLORS.length) | 0];
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, v = (Math.random() * 1.2 + 1.6) * dpr;
        bursts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col });
      }
      nextBurst = t + 2600 + Math.random() * 3500;
    }
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (const s of sparks) {
        s.p += s.s; s.y -= s.vy; if (s.y < -5) { s.y = H + 5; s.x = Math.random() * W; }
        ctx.globalAlpha = .25 + .55 * (Math.sin(s.p) * .5 + .5);
        ctx.fillStyle = '#f6c453';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      }
      if (t > nextBurst) burst(t);
      bursts = bursts.filter((b) => b.life > 0);
      for (const b of bursts) {
        b.x += b.vx; b.y += b.vy; b.vy += .025 * dpr; b.vx *= .985; b.vy *= .985; b.life -= .012;
        ctx.globalAlpha = Math.max(0, b.life) * .8;
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.arc(b.x, b.y, 1.6 * dpr, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    size();
    addEventListener('resize', size);
    nextBurst = performance.now() + 1200;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  })();

  // ---------- countdown ----------
  (function countdown() {
    const pad = (n) => String(n).padStart(2, '0');
    function tick() {
      const ms = EVENT.start - Date.now();
      if (ms <= 0) {
        $('countdown').hidden = true;
        $('cdDone').hidden = false;
        if (Date.now() > EVENT.end) $('cdDone').textContent = 'Thank you for celebrating with us! 🪔';
        else setTimeout(tick, 60000);
        return;
      }
      const s = Math.floor(ms / 1000);
      $('cdD').textContent = Math.floor(s / 86400);
      $('cdH').textContent = pad(Math.floor((s % 86400) / 3600));
      $('cdM').textContent = pad(Math.floor((s % 3600) / 60));
      $('cdS').textContent = pad(s % 60);
      setTimeout(tick, 1000 - (Date.now() % 1000));
    }
    tick();
  })();

  // ---------- calendar & share ----------
  const gfmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  $('gcal').href = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action: 'TEMPLATE', text: EVENT.title, dates: gfmt(EVENT.start) + '/' + gfmt(EVENT.end),
    location: EVENT.location, details: EVENT.details, ctz: 'America/Los_Angeles',
  });
  $('shareBtn').addEventListener('click', async () => {
    const data = { title: '🪔 Diwali Party 2026', text: 'You’re invited! Fri, Nov 6 · 6 PM · San Jose. RSVP here:', url: EVENT.url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    toast((await copy(EVENT.url)) ? 'Invite link copied!' : EVENT.url);
  });

  // ---------- state ----------
  let state = { me: null, counts: null, guests: [], cats: [] };
  let openForm = null; // { catId, slot, mode: 'claim' | 'update', dish? }
  let rsvpEditing = false;
  const savedName = () => (state.me && state.me.name) || store.get('dw26_name') || '';

  async function refresh() {
    try {
      const d = await api('state');
      state = d;
      renderRsvp(); renderGuests(); renderPotluck();
    } catch (e) {
      $('guestSummary').textContent = e.message;
      if (!state.cats.length) $('cats').replaceChildren(h('p', { class: 'muted' }, e.message));
    }
  }

  // ---------- RSVP ----------
  const form = $('rsvpForm');
  function syncStatus() {
    const st = form.status.value;
    form.classList.toggle('is-no', st === 'no');
    $('rsvpSubmit').textContent = st === 'no' ? 'Send my regrets' : 'Send RSVP';
  }
  form.addEventListener('change', (e) => { if (e.target.name === 'status') syncStatus(); });
  form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const input = b.parentElement.querySelector('input');
    input.value = Math.max(0, Math.min(15, (parseInt(input.value, 10) || 0) + Number(b.dataset.step)));
  }));

  function fillForm(me) {
    form.name.value = me.name || '';
    const radio = form.querySelector(`input[name=status][value="${me.status}"]`);
    if (radio) radio.checked = true;
    form.adults.value = me.status === 'no' ? 1 : me.adults;
    form.kids.value = me.kids;
    form.diet.value = me.diet || '';
    form.note.value = me.note || '';
    syncStatus();
  }

  function renderRsvp() {
    const me = state.me;
    const showDone = me && !rsvpEditing;
    $('rsvpDone').hidden = !showDone;
    form.hidden = !!showDone;
    $('rsvpTitle').textContent = me ? 'Your RSVP' : 'Will you join us?';
    $('heroRsvp').textContent = me ? 'View your RSVP' : 'RSVP';
    if (showDone) {
      const first = me.name.split(/\s+/)[0];
      const ppl = me.adults + me.kids;
      const party = `${me.adults} adult${me.adults === 1 ? '' : 's'}${me.kids ? `, ${me.kids} kid${me.kids === 1 ? '' : 's'}` : ''}`;
      $('rsvpDoneMsg').textContent =
        me.status === 'going' ? `Yay, ${first}! You're going 🎉` :
        me.status === 'maybe' ? `Thanks, ${first}! Marked as maybe 🤔` :
        `We'll miss you, ${first} 💛`;
      $('rsvpDoneSub').textContent = me.status === 'no' ? 'If plans change, you can update your RSVP any time.' : `Party of ${ppl} (${party}).${me.diet ? ' Dietary: ' + me.diet : ''}`;
      $('editLink').value = editUrl();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('rsvpErr'); err.textContent = '';
    if (!form.status.value) { err.textContent = 'Please choose Going, Maybe or Can’t go.'; return; }
    if (!form.name.value.trim()) { err.textContent = 'Please enter your name.'; form.name.focus(); return; }
    const btn = $('rsvpSubmit'); btn.disabled = true;
    try {
      const d = await api('rsvp', {
        name: form.name.value, status: form.status.value,
        adults: form.adults.value, kids: form.kids.value,
        diet: form.diet.value, note: form.note.value, website: form.website.value,
      });
      if (d.fake) return;
      setToken(d.token);
      store.set('dw26_name', d.me.name);
      rsvpEditing = false;
      await refresh();
      toast(d.updated ? 'RSVP updated ✓' : 'RSVP sent ✓');
      $('rsvp').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } catch (ex) {
      err.textContent = ex.message;
    } finally { btn.disabled = false; }
  });
  $('changeRsvp').addEventListener('click', () => {
    rsvpEditing = true; fillForm(state.me); renderRsvp(); form.name.focus();
  });
  $('copyEdit').addEventListener('click', async () => toast((await copy(editUrl())) ? 'Private link copied. Save it somewhere safe.' : 'Copy the link manually.'));

  // ---------- guests ----------
  const AV = ['#f6c453', '#f28c18', '#e8457a', '#7fe3d6', '#ffdf8a', '#c79bff'];
  function renderGuests() {
    const c = state.counts;
    const g = c.going, m = c.maybe;
    const ppl = (x) => `${x.adults} adult${x.adults === 1 ? '' : 's'}${x.kids ? `, ${x.kids} kid${x.kids === 1 ? '' : 's'}` : ''}`;
    $('guestSummary').textContent = g.parties || m.parties
      ? `${g.adults + g.kids} going (${ppl(g)})` + (m.parties ? ` · ${m.adults + m.kids} maybe` : '') + (c.no.parties ? ` · ${c.no.parties} can't make it` : '')
      : 'Be the first to RSVP!';
    const groups = [['going', 'Going'], ['maybe', 'Maybe']].map(([k, label]) => {
      const list = state.guests.filter((x) => x.status === k);
      if (!list.length) return null;
      return h('div', null,
        h('h3', null, `${label} · ${list.length}`),
        h('div', { class: 'people' }, list.map((p, i) => {
          const extra = p.adults + p.kids - 1;
          return h('span', { class: 'person' },
            h('span', { class: 'avatar', style: `background:${AV[(p.name.charCodeAt(0) + i) % AV.length]}` }, p.name[0]),
            p.name, extra > 0 ? h('span', { class: 'plus' }, '+' + extra) : null);
        })));
    });
    $('guestList').replaceChildren(...groups.filter(Boolean));
  }

  // ---------- potluck ----------
  const isOpenEnded = (c) => !c.slots;
  const taken = (c) => c.slots ? c.claims.filter((x) => Number(x.slot) <= c.slots).length : c.claims.length;
  const isFull = (c) => !isOpenEnded(c) && taken(c) >= c.slots;

  function renderPotluck() {
    // summary chips
    $('potSummary').replaceChildren(...state.cats.map((c) =>
      isOpenEnded(c)
        ? h('span', { class: 'chip' }, `${c.name} ${c.claims.length ? '· ' + c.claims.length : ''}`)
        : h('span', { class: 'chip ' + (isFull(c) ? 'full' : 'need') }, `${c.name} ${taken(c)}/${c.slots}${isFull(c) ? ' ✓' : ''}`)));

    if (!state.cats.length) { $('cats').replaceChildren(h('p', { class: 'muted' }, 'No potluck categories yet.')); return; }
    $('cats').replaceChildren(...state.cats.map(renderCat));
    const f = document.querySelector('.claimform input[name=dish]');
    if (f && document.activeElement === document.body) f.focus();
  }

  function openSpotsElsewhere(cat) {
    return state.cats.filter((c) => c.id !== cat.id && (isOpenEnded(c) || !isFull(c)));
  }

  function renderCat(c) {
    const rows = [];
    if (isOpenEnded(c)) {
      c.claims.forEach((cl) => rows.push(slotRow(c, cl)));
      rows.push(openRow(c, 'open', c.claims.length ? '＋ Add another dish' : '＋ Add your dish'));
    } else {
      for (let i = 1; i <= c.slots; i++) {
        const cl = c.claims.find((x) => x.slot === String(i));
        rows.push(cl ? slotRow(c, cl) : openRow(c, String(i), 'Open spot · tap to claim'));
      }
      c.claims.filter((x) => !(Number(x.slot) >= 1 && Number(x.slot) <= c.slots)).forEach((cl) => rows.push(slotRow(c, cl)));
    }
    let note = null;
    if (isFull(c)) {
      const others = openSpotsElsewhere(c);
      note = h('p', { class: 'full-note' }, `✓ ${c.name} is all covered, thank you! `,
        others.length ? ['Still open: ', ...others.slice(0, 5).flatMap((o, i) => [i ? ', ' : '', h('a', { href: '#cat-' + o.id }, o.name)])] : null);
    }
    const count = isOpenEnded(c) ? (c.claims.length ? `${c.claims.length} dish${c.claims.length === 1 ? '' : 'es'}` : 'any dish welcome') : `${taken(c)} of ${c.slots} claimed`;
    return h('div', { class: 'cat', id: 'cat-' + c.id },
      h('div', { class: 'cat-head' },
        h('h3', null, c.name, c.byGuest ? h('span', { class: 'badge', title: 'Added by a guest' }, 'guest-added') : null),
        h('span', { class: 'count' }, count)),
      h('div', { class: 'slots' }, rows),
      note);
  }

  const formFor = (c, slot) => openForm && openForm.catId === c.id && openForm.slot === slot;

  function openRow(c, slot, label) {
    if (formFor(c, slot)) return claimForm(c, slot);
    return h('button', { type: 'button', class: 'slot open', onclick: () => { openForm = { catId: c.id, slot, mode: 'claim' }; $('potErr').textContent = ''; renderPotluck(); } }, label);
  }

  function slotRow(c, cl) {
    if (cl.mine && formFor(c, cl.slot)) return claimForm(c, cl.slot, cl);
    const tools = cl.mine ? h('span', { class: 'tools' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { openForm = { catId: c.id, slot: cl.slot, mode: 'update' }; renderPotluck(); } }, 'Edit'),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: (e) => release(e.currentTarget, c, cl) }, 'Remove')) : null;
    return h('div', { class: 'slot taken' + (cl.mine ? ' mine' : '') },
      h('span', { class: 'who' }, h('b', null, cl.name), ': ', cl.dish, cl.mine ? ' (you)' : ''), tools);
  }

  function claimForm(c, slot, existing) {
    const errEl = h('p', { class: 'err', role: 'alert' });
    const nameIn = h('input', { name: 'name', maxLength: 60, required: true, placeholder: 'Your name', value: savedName(), autocomplete: 'name' });
    const dishIn = h('input', { name: 'dish', maxLength: 80, required: true, placeholder: c.name === 'Others' ? 'What are you bringing?' : `Which ${c.name.toLowerCase().replace(/s$/, '')}?`, value: existing ? existing.dish : '' });
    const hp = h('input', { name: 'website', tabIndex: -1, autocomplete: 'off' });
    const submit = h('button', { type: 'submit', class: 'btn btn-gold' }, existing ? 'Save' : 'Claim it');
    const f = h('form', { class: 'claimform', novalidate: true },
      h('label', { class: 'field' }, h('span', null, 'Your name'), nameIn),
      h('label', { class: 'field' }, h('span', null, 'What you’re bringing'), dishIn),
      h('label', { class: 'hp', 'aria-hidden': 'true' }, 'Website ', hp),
      errEl,
      h('div', { class: 'btns' },
        h('button', { type: 'button', class: 'btn', onclick: () => { openForm = null; renderPotluck(); } }, 'Cancel'),
        submit));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      if (!nameIn.value.trim()) { errEl.textContent = 'Please add your name.'; nameIn.focus(); return; }
      if (!dishIn.value.trim()) { errEl.textContent = 'Please say what you’re bringing.'; dishIn.focus(); return; }
      submit.disabled = true;
      try {
        const d = await api('potluck', { action: existing ? 'update' : 'claim', catId: c.id, slot, name: nameIn.value, dish: dishIn.value, website: hp.value });
        if (d.fake) return;
        setToken(d.token);
        store.set('dw26_name', nameIn.value.trim());
        openForm = null;
        await refresh();
        toast(existing ? 'Dish updated ✓' : `Thank you! ${dishIn.value.trim()} is on the menu 🎉`);
      } catch (ex) {
        if (['TAKEN', 'FULL', 'STALE'].includes(ex.code)) {
          openForm = null;
          await refresh();
          $('potErr').textContent = ex.message;
          $('potErr').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        } else {
          errEl.textContent = ex.message;
          submit.disabled = false;
        }
      }
    });
    setTimeout(() => (nameIn.value ? dishIn : nameIn).focus({ preventScroll: true }), 0);
    return f;
  }

  async function release(btn, c, cl) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = 'Tap to confirm';
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Remove'; } }, 3500);
      return;
    }
    btn.disabled = true;
    try {
      await api('potluck', { action: 'release', catId: c.id, slot: cl.slot });
      toast('Removed. The spot is open again.');
    } catch (ex) { $('potErr').textContent = ex.message; }
    await refresh();
  }

  // new category
  $('catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = $('catErr'); err.textContent = '';
    if (!f.name.value.trim()) { err.textContent = 'Please name the category.'; return; }
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const d = await api('potluck', { action: 'addCategory', name: f.name.value, slots: f.slots.value, website: f.website.value });
      if (d.fake) return;
      f.reset(); f.closest('details').open = false;
      openForm = { catId: d.id, slot: f.slots.value === '0' ? 'open' : '1', mode: 'claim' };
      await refresh();
      // if the new category has numbered slots, open slot 1; open-ended uses "open"
      const cat = state.cats.find((x) => x.id === d.id);
      if (cat) { openForm.slot = cat.slots ? '1' : 'open'; renderPotluck(); document.getElementById('cat-' + d.id)?.scrollIntoView({ block: 'center' }); }
      toast('Category added. Now add your dish!');
    } catch (ex) { err.textContent = ex.message; }
    finally { btn.disabled = false; }
  });

  // keep the lists fresh (but never while someone is typing)
  setInterval(() => {
    if (document.hidden || openForm || rsvpEditing) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    refresh();
  }, 20000);

  syncStatus();
  refresh();
})();
