(() => {
  'use strict';

  const CONFIG = {
    bookingUrl: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1kThzYJfdGonutqzFrHauIV1iXPbzJHKFxeQREo28wKecttH7RAnwR_Xusv8xJHABDgGwgoDl-',
    theme: 'Platinum',
    pattern: true,
    scanlines: false,
  };

  const SIZES = {
    resume: [660, 540],
    projects: [440, 300],
    contact: [420, 320],
    contacts: [380, 360],
    mail: [480, 420],
    trash: [400, 240],
    calendar: [740, 560],
  };

  const INITIAL = {
    open: { resume: true, projects: false, contact: true, contacts: false, mail: false, trash: false, calendar: false },
    pos: {
      resume: { x: 80, y: 70 },
      projects: { x: 160, y: 120 },
      contact: { x: 210, y: 150 },
      contacts: { x: 250, y: 100 },
      mail: { x: 140, y: 90 },
      trash: { x: 260, y: 170 },
      calendar: { x: 110, y: 60 },
    },
    z: { resume: 11, contact: 12 },
  };

  const state = {
    open: { ...INITIAL.open },
    pos: Object.fromEntries(Object.entries(INITIAL.pos).map(([k, v]) => [k, { ...v }])),
    z: { ...INITIAL.z },
    shaded: {},
    maxed: {},
    topZ: 12,
  };

  const winEls = {};
  for (const id of Object.keys(SIZES)) {
    winEls[id] = document.getElementById('win-' + id);
  }

  function clamp(id) {
    const [bw, bh] = SIZES[id];
    const maxed = !!state.maxed[id];
    const shaded = !!state.shaded[id];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(bw, vw - 24);
    const ch = Math.min(bh, vh - 44);
    const p = state.pos[id];
    const cx = Math.max(6, Math.min(p.x, vw - cw - 12));
    const cy = Math.max(28, Math.min(p.y, vh - ch - 12));
    return {
      x: maxed ? 6 : cx,
      y: maxed ? 32 : cy,
      w: maxed ? Math.max(320, vw - 130) : cw,
      h: shaded ? null : (maxed ? Math.max(240, vh - 44) : ch),
      z: state.z[id] || 10,
    };
  }

  function render(id) {
    const el = winEls[id];
    if (!el) return;
    const c = clamp(id);
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.style.width = c.w + 'px';
    el.style.height = c.h === null ? 'auto' : c.h + 'px';
    el.style.zIndex = c.z;
    el.classList.toggle('open', !!state.open[id]);
    el.classList.toggle('shaded', !!state.shaded[id]);
  }

  function renderAll() {
    for (const id of Object.keys(SIZES)) render(id);
  }

  function focusWin(id) {
    state.topZ += 1;
    state.z[id] = state.topZ;
    render(id);
  }

  function openWin(id) {
    state.open[id] = true;
    state.shaded[id] = false;
    focusWin(id);
  }

  function closeWin(id) {
    state.open[id] = false;
    state.maxed[id] = false;
    state.shaded[id] = false;
    render(id);
  }

  function shadeWin(id) {
    state.shaded[id] = !state.shaded[id];
    render(id);
  }

  function zoomWin(id) {
    state.maxed[id] = !state.maxed[id];
    state.shaded[id] = false;
    render(id);
  }

  function startDrag(id, e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    focusWin(id);
    if (state.maxed[id]) return;
    const start = { mx: e.clientX, my: e.clientY, x: state.pos[id].x, y: state.pos[id].y };
    function move(ev) {
      state.pos[id] = {
        x: start.x + (ev.clientX - start.mx),
        y: Math.max(28, start.y + (ev.clientY - start.my)),
      };
      render(id);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Wire up window chrome + icons

  for (const id of Object.keys(SIZES)) {
    const el = winEls[id];
    if (!el) continue;
    el.addEventListener('pointerdown', () => focusWin(id));
    el.querySelector('[data-action="close"]').addEventListener('click', (e) => { e.stopPropagation(); closeWin(id); });
    el.querySelector('[data-action="shade"]').addEventListener('click', (e) => { e.stopPropagation(); shadeWin(id); });
    el.querySelector('[data-action="zoom"]').addEventListener('click', (e) => { e.stopPropagation(); zoomWin(id); });
    el.querySelector('[data-drag]').addEventListener('pointerdown', (e) => startDrag(id, e));
  }

  document.querySelectorAll('.icon[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openWin(btn.dataset.open));
  });

  window.addEventListener('resize', renderAll);

  // ═══ Menu bar clock ═══

  function tick() {
    const d = new Date();
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    document.getElementById('clock').textContent = day + ' ' + md + '  ' + t;
  }
  tick();
  setInterval(tick, 10000);

  // ═══ Theme / appearance ═══

  document.documentElement.dataset.theme = CONFIG.theme;
  document.getElementById('desktop').classList.toggle('no-pattern', !CONFIG.pattern);
  document.getElementById('scanlines').classList.toggle('on', !!CONFIG.scanlines);

  // ═══ Mail form ═══

  const mailForm = document.getElementById('mail-form');
  const mailSent = document.getElementById('mail-sent');
  const mailError = document.getElementById('mail-error');

  mailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const from = document.getElementById('mail-from').value.trim();
    const subj = document.getElementById('mail-subject').value.trim();
    const msg = document.getElementById('mail-message').value.trim();
    if (!from || !subj || !msg) {
      mailError.textContent = 'All fields are required.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      mailError.textContent = "That email doesn't look right.";
      return;
    }
    mailError.textContent = '';
    mailForm.style.display = 'none';
    mailSent.classList.add('show');
  });

  document.getElementById('mail-reset').addEventListener('click', () => {
    mailForm.reset();
    mailError.textContent = '';
    mailSent.classList.remove('show');
    mailForm.style.display = '';
  });

  // ═══ Calendar / booking ═══

  function bookingSrc(url) {
    const u = (url || '').trim();
    if (!u) return '';
    if (u.indexOf('calendar.app.google') !== -1 || u.indexOf('calendar.google.com') !== -1) {
      return u + (u.indexOf('?') === -1 ? '?gv=true' : '&gv=true');
    }
    return u;
  }

  const bookingUrl = bookingSrc(CONFIG.bookingUrl);
  if (bookingUrl) {
    document.getElementById('booking-iframe').src = bookingUrl;
    document.getElementById('booking-link').href = CONFIG.bookingUrl.trim();
  } else {
    document.getElementById('booking-has').style.display = 'none';
    document.getElementById('booking-empty').style.display = '';
  }

  renderAll();
})();
