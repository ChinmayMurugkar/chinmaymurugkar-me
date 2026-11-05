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

  // ---------- "Happy Diwali" letters (staggered 3D rise + shimmer) ----------
  (function letters() {
    const el = $('happy');
    const txt = el.textContent;
    el.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      if (ch === ' ') s.className = 'sp';
      else { s.className = 'ch'; s.textContent = ch; s.style.setProperty('--i', i); }
      el.append(s);
    });
  })();

  // ---------- rangoli (floor art under the diya) ----------
  (function rangoli() {
    const svg = $('rangoli');
    const NS = 'http://www.w3.org/2000/svg';
    const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
    add('circle', { r: 99, fill: '#fff', opacity: .55 });
    const rings = [
      { n: 20, r: 90, len: 9, w: 5, c: '#a35cff' },
      { n: 16, r: 76, len: 13, w: 7, c: '#f5b82e' },
      { n: 12, r: 56, len: 18, w: 10, c: '#ec4f8a' },
      { n: 8, r: 34, len: 18, w: 11, c: '#ff8a3d' },
      { n: 8, r: 15, len: 11, w: 7, c: '#14a394' },
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
      add('circle', { r: ring.r - ring.len - 3, fill: 'none', stroke: '#b7791f', 'stroke-width': .8, 'stroke-dasharray': '1.5 3.5', opacity: .6 });
    });
    for (let i = 0; i < 36; i++) add('circle', { r: 1.8, cy: -97, fill: i % 2 ? '#ec4f8a' : '#f5b82e', transform: `rotate(${i * 10})` });
    add('circle', { r: 6, fill: '#f5b82e' });
  })();

  // ---------- fireworks & glitter (colorful on a light sky) ----------
  (function sky() {
    if (reduceMotion) return;
    const c = $('sky'), ctx = c.getContext('2d');
    let W, H, dpr, glitter = [], parts = [], rockets = [], raf = 0, nextBurst = 0;
    const PALETTES = [
      ['#ff5e8a', '#ffb3c9', '#ff9f43'], ['#a35cff', '#d4b8ff', '#ff5e8a'], ['#f59e0b', '#ffd27a', '#ff8a3d'],
      ['#14a394', '#7fe6d6', '#3b82f6'], ['#ec4f8a', '#f5b82e', '#a35cff'],
    ];
    const GL = ['#f5b82e', '#ec4f8a', '#a35cff', '#14a394', '#ff8a3d'];
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr;
      glitter = Array.from({ length: Math.round(Math.min(46, innerWidth / 14)) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.6 + .6) * dpr,
        p: Math.random() * 6.3, s: Math.random() * .03 + .01, vy: (Math.random() * .2 + .06) * dpr, col: GL[(Math.random() * GL.length) | 0],
      }));
    }
    function launch(xf) {
      const x = W * (xf ?? (.12 + Math.random() * .76));
      rockets.push({ x, y: H + 10, vy: -(H * (.0105 + Math.random() * .004)), ty: H * (.12 + Math.random() * .28), pal: PALETTES[(Math.random() * PALETTES.length) | 0] });
    }
    function explode(x, y, pal) {
      const n = 70, ring = Math.random() < .5;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * .05;
        const v = (ring ? 3.2 : Math.random() * 3.4 + .6) * dpr;
        parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: .010 + Math.random() * .008, col: pal[i % pal.length], r: (Math.random() * 1.2 + 1.4) * dpr });
      }
    }
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (const g of glitter) {
        g.p += g.s; g.y -= g.vy; if (g.y < -5) { g.y = H + 5; g.x = Math.random() * W; }
        const tw = Math.sin(g.p) * .5 + .5;
        ctx.globalAlpha = .2 + .6 * tw; ctx.fillStyle = g.col;
        ctx.beginPath(); ctx.moveTo(g.x, g.y - g.r * 2.2 * tw); ctx.lineTo(g.x + g.r * .7, g.y); ctx.lineTo(g.x, g.y + g.r * 2.2 * tw); ctx.lineTo(g.x - g.r * .7, g.y); ctx.fill();
      }
      if (t > nextBurst) { launch(); nextBurst = t + 2200 + Math.random() * 2800; }
      rockets = rockets.filter((r) => {
        r.y += r.vy; r.vy *= .985;
        ctx.globalAlpha = .9; ctx.fillStyle = r.pal[0];
        ctx.beginPath(); ctx.arc(r.x, r.y, 2 * dpr, 0, 7); ctx.fill();
        ctx.globalAlpha = .35; ctx.fillRect(r.x - .6 * dpr, r.y, 1.2 * dpr, 26 * dpr);
        if (r.y <= r.ty || r.vy > -1) { explode(r.x, r.y, r.pal); return false; }
        return true;
      });
      parts = parts.filter((p) => p.life > 0);
      ctx.lineCap = 'round';
      for (const p of parts) {
        p.px = p.x; p.py = p.y;
        p.x += p.vx; p.y += p.vy; p.vy += .03 * dpr; p.vx *= .975; p.vy *= .975; p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.strokeStyle = p.col; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(p.px - p.vx * 2, p.py - p.vy * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    size();
    addEventListener('resize', size);
    // opening salvo for the "Happy Diwali" entrance
    [.25, .75, .5, .15, .85].forEach((xf, i) => setTimeout(() => launch(xf), 250 + i * 330));
    nextBurst = performance.now() + 4500;
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  })();

  // ---------- 3D tilt on the hero art ----------
  (function tilt() {
    if (reduceMotion) return;
    const hero = document.querySelector('.hero'), inner = document.querySelector('.art-inner');
    if (!hero || !inner) return;
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      inner.style.setProperty('--ry', (x * 18).toFixed(2) + 'deg');
      inner.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => { inner.style.setProperty('--ry', '0deg'); inner.style.setProperty('--rx', '0deg'); });
    // phones: a gentle automatic sway so the scene still feels 3D
    if (matchMedia('(hover: none)').matches) {
      let t0 = performance.now();
      const loop = (t) => {
        const k = (t - t0) / 1000;
        inner.style.setProperty('--ry', (Math.sin(k * .6) * 8).toFixed(2) + 'deg');
        inner.style.setProperty('--rx', (Math.cos(k * .45) * 4).toFixed(2) + 'deg');
        if (!document.hidden && location.hash.replace('#', '') in { '': 1, home: 1 }) requestAnimationFrame(loop);
        else setTimeout(() => requestAnimationFrame(loop), 600);
      };
      requestAnimationFrame(loop);
    }
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
    $('heroRsvp').textContent = me ? 'Your RSVP' : 'RSVP';
    $('navRsvpDot').hidden = !!me;
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
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    } catch (ex) {
      err.textContent = ex.message;
    } finally { btn.disabled = false; }
  });
  $('changeRsvp').addEventListener('click', () => {
    rsvpEditing = true; fillForm(state.me); renderRsvp(); form.name.focus();
  });
  $('copyEdit').addEventListener('click', async () => toast((await copy(editUrl())) ? 'Private link copied. Save it somewhere safe.' : 'Copy the link manually.'));

  // ---------- guests ----------
  const AV = ['linear-gradient(140deg,#ffc56b,#f08a12)', 'linear-gradient(140deg,#ff9ec2,#e2366f)', 'linear-gradient(140deg,#c9b6ff,#7c4dff)', 'linear-gradient(140deg,#8cf0e2,#14a394)', 'linear-gradient(140deg,#93c5fd,#3b82f6)', 'linear-gradient(140deg,#fdba74,#ea580c)'];
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
    const ppl0 = g.adults + g.kids;
    $('navGuests').hidden = !ppl0; $('navGuests').textContent = ppl0;
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

    const openSpots = state.cats.reduce((n, c) => n + (isOpenEnded(c) ? 0 : Math.max(0, c.slots - taken(c))), 0);
    $('navPot').hidden = !openSpots; $('navPot').textContent = openSpots; $('navPot').title = openSpots + ' open spots';
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

  // ---------- one-page router: one section at a time ----------
  const VIEWS = [...document.querySelectorAll('[data-view]')].map((v) => v.dataset.view);
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    let view = VIEWS.includes(h) ? h : null, target = null;
    if (!view && h) { // deep link to something inside a view, e.g. #cat-sweets
      target = document.getElementById(h);
      const host = target && target.closest('[data-view]');
      view = host ? host.dataset.view : null;
    }
    view = view || 'home';
    document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== view; });
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === view;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }));
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  addEventListener('hashchange', route);
  route();

  syncStatus();
  refresh();
})();
