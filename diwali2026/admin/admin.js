(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ss = {
    get() { try { return sessionStorage.getItem('dw26_admin'); } catch { return null; } },
    set(v) { try { v ? sessionStorage.setItem('dw26_admin', v) : sessionStorage.removeItem('dw26_admin'); } catch { /* ignore */ } },
  };
  let key = ss.get();
  let data = null;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  let tt;
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

  async function api(body) {
    const opts = { headers: { 'x-admin-key': key || '' } };
    if (body) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, d;
    try { res = await fetch('/api/diwali/admin', opts); d = await res.json(); }
    catch { throw new Error('Couldn’t reach the server.'); }
    if (!d.ok) throw Object.assign(new Error(d.error || 'Error'), { status: res.status });
    return d;
  }

  async function load() {
    try {
      data = await api();
      $('login').hidden = true; $('app').hidden = false; $('err').textContent = '';
      render();
    } catch (e) {
      if (e.status === 401 || e.status === 503 && /Admin key/.test(e.message)) { ss.set(null); key = null; showLogin(e.message); }
      else $('err').textContent = e.message;
    }
  }
  function showLogin(msg) { $('app').hidden = true; $('login').hidden = false; $('loginErr').textContent = msg || ''; }

  async function act(body, okMsg) {
    $('err').textContent = '';
    try { await api(body); if (okMsg) toast(okMsg); }
    catch (e) { $('err').textContent = e.message; window.scrollTo(0, 0); }
    await load();
  }

  // two-tap confirm for destructive buttons
  function confirmBtn(label, onConfirm, cls = 'btn btn-sm danger') {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', () => {
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1'; b.textContent = 'Sure?';
        setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = label; } }, 3000);
        return;
      }
      b.disabled = true; onConfirm();
    });
    return b;
  }

  const fmt = (ts) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  function render() {
    const r = data.rsvps;
    const sum = (st, f) => r.filter((x) => x.status === st).reduce((a, x) => a + x[f], 0);
    const cnt = (st) => r.filter((x) => x.status === st).length;
    const stats = [
      ['Going (people)', sum('going', 'adults') + sum('going', 'kids')],
      ['Going adults', sum('going', 'adults')],
      ['Going kids', sum('going', 'kids')],
      ['Maybe (people)', sum('maybe', 'adults') + sum('maybe', 'kids')],
      ['RSVPs going', cnt('going')], ['RSVPs maybe', cnt('maybe')], ["Can't go", cnt('no')],
      ['Dishes signed up', data.cats.reduce((a, c) => a + c.claims.length, 0)],
    ];
    $('stats').replaceChildren(...stats.map(([l, v]) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l))));

    $('rsvps').replaceChildren(...(r.length ? r.map((x) => h('tr', null,
      h('td', null, x.name),
      h('td', { class: 'st-' + x.status }, { going: 'Going', maybe: 'Maybe', no: "Can't go" }[x.status]),
      h('td', null, x.adults), h('td', null, x.kids),
      h('td', { class: 'note' }, x.diet || ''), h('td', { class: 'note' }, x.note || ''),
      h('td', { class: 'small' }, fmt(x.updated)),
      h('td', null, confirmBtn('Delete', () => act({ action: 'deleteRsvp', id: x.id }, 'RSVP removed'))),
    )) : [h('tr', null, h('td', { colSpan: 8, class: 'small' }, 'No RSVPs yet.'))]));

    const cats = data.cats;
    $('acats').replaceChildren(...cats.map((c, i) => {
      const nameIn = h('input', { name: 'name', value: c.name, maxLength: 30, 'aria-label': 'Category name' });
      const slotsIn = h('input', { name: 'slots', type: 'number', min: 0, max: 50, value: c.slots, 'aria-label': 'Spots' });
      const mergeSel = h('select', { 'aria-label': 'Merge into' }, h('option', { value: '' }, 'Merge into…'),
        cats.filter((o) => o.id !== c.id).map((o) => h('option', { value: o.id }, o.name)));
      const move = (dir) => {
        const ids = cats.map((x) => x.id); const j = i + dir;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        act({ action: 'reorder', ids });
      };
      return h('div', { class: 'acat' },
        h('div', { class: 'acat-row' },
          h('button', { type: 'button', class: 'btn btn-sm', disabled: i === 0, onclick: () => move(-1), 'aria-label': 'Move up' }, '↑'),
          h('button', { type: 'button', class: 'btn btn-sm', disabled: i === cats.length - 1, onclick: () => move(1), 'aria-label': 'Move down' }, '↓'),
          nameIn,
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => act({ action: 'renameCategory', id: c.id, name: nameIn.value }, 'Renamed') }, 'Rename'),
          c.byGuest ? h('span', { class: 'badge' }, 'guest-added') : null),
        h('div', { class: 'acat-row' },
          h('span', { class: 'small' }, `${c.claims.length} signed up · spots:`), slotsIn,
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => act({ action: 'setSlots', id: c.id, slots: slotsIn.value }, 'Spots updated') }, 'Set spots'),
          mergeSel,
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => mergeSel.value ? act({ action: 'mergeCategory', from: c.id, to: mergeSel.value }, 'Merged') : toast('Pick a category to merge into') }, 'Merge'),
          confirmBtn('Delete category', () => act({ action: 'deleteCategory', id: c.id }, 'Category deleted'))),
        c.claims.length ? h('div', { class: 'claims' }, c.claims.map((cl) => h('div', { class: 'claim' },
          h('span', null, h('b', null, cl.name), ': ', cl.dish, h('span', { class: 'small' }, `  · ${fmt(cl.ts)}`)),
          confirmBtn('Free', () => act({ action: 'freeSlot', id: c.id, slot: cl.slot }, 'Spot freed'))))) : h('span', { class: 'small' }, 'No dishes yet.'));
    }));
  }

  // CSV (with spreadsheet formula-injection guard)
  function csv(rows) {
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }
  function download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  $('expRsvp').addEventListener('click', () => download('diwali2026-rsvps.csv', csv([
    ['Name', 'Status', 'Adults', 'Kids', 'Dietary', 'Note', 'Created', 'Updated'],
    ...data.rsvps.map((x) => [x.name, x.status, x.adults, x.kids, x.diet, x.note, new Date(x.created).toISOString(), new Date(x.updated).toISOString()]),
  ])));
  $('expPot').addEventListener('click', () => download('diwali2026-potluck.csv', csv([
    ['Category', 'Spots', 'Name', 'Dish', 'Signed up'],
    ...data.cats.flatMap((c) => c.claims.length ? c.claims.map((cl) => [c.name, c.slots || 'open', cl.name, cl.dish, new Date(cl.ts).toISOString()]) : [[c.name, c.slots || 'open', '', '', '']]),
  ])));

  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault(); key = e.currentTarget.key.value; ss.set(key); $('loginErr').textContent = ''; load();
  });
  $('addCat').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.currentTarget;
    act({ action: 'addCategory', name: f.name.value, slots: f.slots.value }, 'Category added').then(() => f.reset());
  });
  $('reload').addEventListener('click', load);
  $('logout').addEventListener('click', () => { ss.set(null); key = null; showLogin(); });

  if (key) load(); else showLogin();
})();
