(() => {
  'use strict';

  const CONFIG = {
    bookingUrl: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1kThzYJfdGonutqzFrHauIV1iXPbzJHKFxeQREo28wKecttH7RAnwR_Xusv8xJHABDgGwgoDl-',
    theme: 'Platinum',
    pattern: true,
    scanlines: false,
  };

  const EMAIL = 'mchughpf@gmail.com';

  // FormSubmit.co AJAX endpoint — delivers form submissions to MAIL_TARGET
  // without a backend. One-time setup: the first submission from the live
  // site triggers an activation email; click its confirmation link once.
  // Anti-scraping: after activating, replace MAIL_TARGET with the random
  // alias from https://formsubmit.co (it delivers to the same inbox but
  // keeps the address out of the page source, and can be revoked if abused).
  const MAIL_TARGET = EMAIL;
  const MAIL_ENDPOINT = 'https://formsubmit.co/ajax/' + MAIL_TARGET;

  const HELLO_TEXT = "═══ HELLO ═══\n\nHi, I'm Pauline. Welcome to my desktop.\nPoke around — my resume is on the desktop,\nand you can drop me a line with Mail.\n\nemail ...... mchughpf@gmail.com\nlocation ... Houston, TX\nlinkedin ... linkedin.com/in/pfmchugh\n\nSay hi — I read everything.";

  const README_TEXT = "═══ README ═══\n\nWhat's cooking:\n\n- pauline-os v2 (you are here)\n- writing up QA war stories\n- more apps for this desktop\n\nCheck back soon — this folder\nwon't stay empty for long.";

  const SIZES = {
    resume: [660, 540],
    projects: [440, 300],
    contact: [420, 320],
    contacts: [380, 360],
    mail: [480, 420],
    trash: [400, 240],
    calendar: [740, 560],
    readme: [440, 360],
  };

  const MIN_SIZE = { w: 220, h: 140 };

  const INITIAL = {
    open: { resume: false, projects: false, contact: true, contacts: false, mail: false, trash: false, calendar: false, readme: false },
    pos: {
      resume: { x: 80, y: 70 },
      projects: { x: 160, y: 120 },
      contact: { x: 210, y: 150 },
      contacts: { x: 250, y: 100 },
      mail: { x: 140, y: 90 },
      trash: { x: 260, y: 170 },
      calendar: { x: 110, y: 60 },
      readme: { x: 240, y: 130 },
    },
    z: { resume: 11, contact: 12 },
  };

  const state = {
    open: { ...INITIAL.open },
    pos: Object.fromEntries(Object.entries(INITIAL.pos).map(([k, v]) => [k, { ...v }])),
    size: Object.fromEntries(Object.entries(SIZES).map(([k, [w, h]]) => [k, { w, h }])),
    z: { ...INITIAL.z },
    shaded: {},
    maxed: {},
    topZ: 12,
    trashItems: [
      { name: 'impostor_syndrome.zip', note: '4.2 GB — safe to delete' },
      { name: 'flaky_test_v47.js', note: 'passes on the 48th try' },
      { name: 'selenium_ide_scripts/', note: 'it was a different time' },
    ],
    clockMode: 0,
    scanlinesOn: CONFIG.scanlines,
    cat: { x: -60, dir: 1, mode: 'hidden', dur: 0 },
  };

  const winEls = {};
  for (const id of Object.keys(SIZES)) {
    winEls[id] = document.getElementById('win-' + id);
  }

  // ═══ Window management ═══

  function clamp(id) {
    const { w: bw, h: bh } = state.size[id];
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
    el.classList.toggle('maxed', !!state.maxed[id]);
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
    if (id === 'contact') startTyping();
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

  function startResize(id, e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (state.maxed[id] || state.shaded[id]) return;
    e.preventDefault();
    e.stopPropagation();
    focusWin(id);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const start = { mx: e.clientX, my: e.clientY, w: state.size[id].w, h: state.size[id].h };
    function move(ev) {
      const maxW = vw - state.pos[id].x - 12;
      const maxH = vh - state.pos[id].y - 12;
      state.size[id] = {
        w: Math.max(MIN_SIZE.w, Math.min(start.w + (ev.clientX - start.mx), maxW)),
        h: Math.max(MIN_SIZE.h, Math.min(start.h + (ev.clientY - start.my), maxH)),
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

  for (const id of Object.keys(SIZES)) {
    const el = winEls[id];
    if (!el) continue;
    el.addEventListener('pointerdown', () => focusWin(id));
    el.querySelector('[data-action="close"]').addEventListener('click', (e) => { e.stopPropagation(); closeWin(id); });
    el.querySelector('[data-action="shade"]').addEventListener('click', (e) => { e.stopPropagation(); shadeWin(id); });
    el.querySelector('[data-action="zoom"]').addEventListener('click', (e) => { e.stopPropagation(); zoomWin(id); });
    el.querySelector('[data-drag]').addEventListener('pointerdown', (e) => startDrag(id, e));
    const resizeHandle = el.querySelector('[data-resize]');
    if (resizeHandle) resizeHandle.addEventListener('pointerdown', (e) => startResize(id, e));
  }

  document.querySelectorAll('.icon[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openWin(btn.dataset.open));
  });

  window.addEventListener('resize', renderAll);

  // README opens from inside the Projects folder
  document.getElementById('open-readme').addEventListener('click', () => openWin('readme'));

  // ═══ Menu bar dropdowns ═══

  const menuBar = document.getElementById('menu-bar');
  const menuOverlay = document.getElementById('menu-overlay');
  const menuItems = Array.from(menuBar.querySelectorAll('.menu-item'));

  function closeMenus() {
    menuItems.forEach((m) => m.classList.remove('active'));
    menuOverlay.classList.remove('on');
  }

  menuItems.forEach((item) => {
    item.querySelector('.menu-label').addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = item.classList.contains('active');
      closeMenus();
      if (!wasActive) {
        item.classList.add('active');
        menuOverlay.classList.add('on');
      }
    });
  });

  menuOverlay.addEventListener('click', closeMenus);

  const MENU_ACTIONS = {
    'open-resume': () => openWin('resume'),
    'new-job-offer': () => openWin('mail'),
    'shut-down': () => showDialog('Nice try.', 'Pauline OS runs 24/7. Uptime: 15 years and counting.'),
    'copy-email': () => {
      if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).catch(() => {});
      showDialog('Copied!', EMAIL + ' is on your clipboard. Use it wisely.');
    },
    'clean-up': cleanUp,
    'toggle-scanlines': () => setScanlines(!state.scanlinesOn),
    'eject': () => showDialog('Pauline cannot be ejected.', 'She is load-bearing.'),
    'empty-trash': () => { emptyTrash(); openWin('trash'); },
    'restart': reboot,
  };

  menuBar.querySelectorAll('.menu-option[data-cmd]').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenus();
      const fn = MENU_ACTIONS[opt.dataset.cmd];
      if (fn) fn();
    });
  });

  // ═══ Menu bar clock (with easter-egg cycle) ═══

  const clockEl = document.getElementById('clock');
  let clockDate = '';
  let clockTime = '';

  function tick() {
    const d = new Date();
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    clockDate = day + ' ' + md;
    clockTime = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    renderClock();
  }

  function renderClock() {
    if (state.clockMode === 1) { clockEl.textContent = 'Uptime: 15 years in QA'; return; }
    if (state.clockMode === 2) { clockEl.textContent = '0 bugs shipped today'; return; }
    // date and time are separate spans so narrow screens can drop the date
    const date = document.createElement('span');
    date.className = 'clock-date';
    date.textContent = clockDate;
    const time = document.createElement('span');
    time.className = 'clock-time';
    time.textContent = clockTime;
    clockEl.replaceChildren(date, time);
  }

  clockEl.addEventListener('click', () => {
    state.clockMode = (state.clockMode + 1) % 3;
    renderClock();
  });

  tick();
  setInterval(tick, 10000);

  // ═══ Theme / appearance ═══

  document.documentElement.dataset.theme = CONFIG.theme;
  document.getElementById('desktop').classList.toggle('no-pattern', !CONFIG.pattern);

  const scanlinesEl = document.getElementById('scanlines');
  function setScanlines(on) {
    state.scanlinesOn = on;
    scanlinesEl.classList.toggle('on', on);
  }
  setScanlines(CONFIG.scanlines);

  // ═══ Desktop clean-up wiggle ═══

  const iconGroup = document.getElementById('desktop-icons');
  const trashIcon = document.getElementById('trash-icon');
  let wiggleTimer;
  function cleanUp() {
    clearTimeout(wiggleTimer);
    iconGroup.classList.add('wiggle');
    trashIcon.classList.add('wiggle');
    wiggleTimer = setTimeout(() => {
      iconGroup.classList.remove('wiggle');
      trashIcon.classList.remove('wiggle');
    }, 1000);
  }

  // ═══ Alert dialog ═══

  const dialogEl = document.getElementById('dialog');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogSub = document.getElementById('dialog-sub');
  function showDialog(title, sub) {
    dialogTitle.textContent = title;
    dialogSub.textContent = sub;
    dialogEl.classList.add('on');
  }
  document.getElementById('dialog-ok').addEventListener('click', () => dialogEl.classList.remove('on'));

  // ═══ Boot screen ═══

  const bootEl = document.getElementById('boot');
  let bootTimer;
  function endBoot() { clearTimeout(bootTimer); bootEl.classList.add('done'); }
  function reboot() {
    clearTimeout(bootTimer);
    bootEl.classList.remove('done');
    bootTimer = setTimeout(endBoot, 2400);
  }
  bootEl.addEventListener('click', endBoot);
  bootTimer = setTimeout(endBoot, 2400);

  // ═══ hello.txt notepad (type-on intro, then editable) ═══

  const helloEl = document.getElementById('hello-text');
  let typeTimer = null;
  function startTyping() {
    clearInterval(typeTimer);
    let n = 0;
    typeTimer = setInterval(() => {
      n += 2;
      helloEl.value = HELLO_TEXT.slice(0, Math.min(n, HELLO_TEXT.length));
      if (n >= HELLO_TEXT.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 18);
  }
  helloEl.addEventListener('focus', () => {
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
      helloEl.value = HELLO_TEXT;
    }
  });
  startTyping();

  // ═══ README notepad ═══

  document.getElementById('readme-text').value = README_TEXT;

  // ═══ Mail form ═══

  const mailForm = document.getElementById('mail-form');
  const mailSent = document.getElementById('mail-sent');
  const mailError = document.getElementById('mail-error');
  const mailSendBtn = mailForm.querySelector('.mail-send');
  let mailSending = false;

  mailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (mailSending) return;
    // Honeypot: humans never see the field, so anything in it is a bot.
    // Show the sent screen without sending, so the bot moves on satisfied.
    if (document.getElementById('mail-honey').value) {
      mailForm.style.display = 'none';
      mailSent.classList.add('show');
      return;
    }
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
    mailSending = true;
    mailSendBtn.disabled = true;
    mailSendBtn.textContent = 'Sending…';
    fetch(MAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: from,
        _replyto: from,
        _subject: '[pauline-os] ' + subj,
        message: msg,
        _template: 'table',
        _captcha: 'false',
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(() => {
        mailForm.style.display = 'none';
        mailSent.classList.add('show');
      })
      .catch(() => {
        mailError.textContent = "Couldn't send — try again, or email me directly.";
      })
      .finally(() => {
        mailSending = false;
        mailSendBtn.disabled = false;
        mailSendBtn.textContent = 'Send ▸';
      });
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

  // ═══ Trash items ═══

  const trashWin = winEls.trash;
  const trashStatusEl = document.getElementById('trash-status');
  const trashListEl = document.getElementById('trash-list');
  const dragGhost = document.getElementById('drag-ghost');
  const dragGhostName = document.getElementById('drag-ghost-name');
  const puffEl = document.getElementById('puff');
  let puffTimer;

  function trashStatusText() {
    const n = state.trashItems.length;
    if (n === 0) return '0 items · squeaky clean';
    if (n === 1) return '1 item · hoarding regret';
    return n + ' items · hoarding regret';
  }

  function renderTrash() {
    const items = state.trashItems;
    trashWin.classList.toggle('trash-clean', items.length === 0);
    trashStatusEl.textContent = trashStatusText();
    trashListEl.innerHTML = '';
    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'trash-item';
      row.innerHTML =
        '<div class="file"><div class="l1"></div><div class="l2"></div></div>' +
        '<div class="meta"><div class="name"></div><div class="note"></div></div>';
      row.querySelector('.name').textContent = item.name;
      row.querySelector('.note').textContent = item.note;
      row.addEventListener('pointerdown', (e) => startTrashDrag(i, e));
      trashListEl.appendChild(row);
    });
  }

  function emptyTrash() {
    state.trashItems = [];
    renderTrash();
  }

  document.getElementById('trash-empty-btn').addEventListener('click', emptyTrash);

  function startTrashDrag(i, e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const item = state.trashItems[i];
    if (!item) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    function move(ev) {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      dragging = true;
      dragGhost.classList.add('on');
      dragGhostName.textContent = item.name;
      dragGhost.style.left = ev.clientX + 'px';
      dragGhost.style.top = ev.clientY + 'px';
    }
    function up(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragGhost.classList.remove('on');
      if (!dragging) return;
      const r = trashWin.getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) {
        state.trashItems = state.trashItems.filter((_, j) => j !== i);
        renderTrash();
        puffEl.style.left = ev.clientX + 'px';
        puffEl.style.top = ev.clientY + 'px';
        puffEl.classList.remove('on');
        // restart the puff animation
        void puffEl.offsetWidth;
        puffEl.classList.add('on');
        clearTimeout(puffTimer);
        puffTimer = setTimeout(() => puffEl.classList.remove('on'), 600);
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  renderTrash();

  // ═══ Pixel corgi ═══

  const catEl = document.getElementById('cat');
  let catTimer;

  function applyCat() {
    const cat = state.cat;
    catEl.classList.toggle('on', cat.mode !== 'hidden');
    catEl.classList.toggle('bob', cat.mode === 'walk' || cat.mode === 'dash');
    catEl.style.transition = 'left ' + cat.dur + 's linear';
    catEl.style.left = cat.x + 'px';
    catEl.style.transform = 'scaleX(' + cat.dir + ')';
  }

  function catStep() {
    const cat = state.cat;
    if (cat.mode === 'hidden') {
      const vw = window.innerWidth;
      const fromLeft = Math.random() < 0.5;
      state.cat = { x: fromLeft ? -60 : vw + 20, dir: fromLeft ? 1 : -1, mode: 'sit', dur: 0 };
      applyCat();
      catTimer = setTimeout(catWalk, 100);
    } else if (cat.mode === 'walk' && Math.random() < 0.5) {
      state.cat = { ...cat, mode: 'sit', dur: 0 };
      applyCat();
      catTimer = setTimeout(catWalk, 2000 + Math.random() * 4000);
    } else {
      catWalk();
    }
  }

  function catWalk() {
    const vw = window.innerWidth;
    const cat = state.cat;
    const target = 40 + Math.random() * Math.max(100, vw - 200);
    const dur = Math.max(1, Math.abs(target - cat.x) / 40);
    state.cat = { x: target, dir: target > cat.x ? 1 : -1, mode: 'walk', dur };
    applyCat();
    catTimer = setTimeout(catStep, dur * 1000 + 100);
  }

  function catDash() {
    clearTimeout(catTimer);
    const vw = window.innerWidth;
    const cat = state.cat;
    const target = cat.dir > 0 ? vw + 80 : -80;
    const dur = Math.max(0.4, Math.abs(target - cat.x) / 300);
    state.cat = { x: target, dir: cat.dir, mode: 'dash', dur };
    applyCat();
    catTimer = setTimeout(() => {
      state.cat = { x: -60, dir: 1, mode: 'hidden', dur: 0 };
      applyCat();
      catTimer = setTimeout(catStep, 15000 + Math.random() * 15000);
    }, dur * 1000 + 100);
  }

  catEl.addEventListener('click', catDash);
  catTimer = setTimeout(catStep, 6000);

  // ═══ Konami confetti ═══

  const confettiEl = document.getElementById('confetti');
  let confettiTimer;
  function dropConfetti() {
    const colors = ['#5c5cc4', '#c4552f', '#7ee2a8', '#e8c56a'];
    confettiEl.innerHTML = '';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('div');
      p.className = 'piece';
      p.textContent = '✓';
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.fontSize = (12 + Math.random() * 16).toFixed(0) + 'px';
      p.style.color = colors[i % colors.length];
      p.style.animationDuration = (2 + Math.random() * 2).toFixed(2) + 's';
      p.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's';
      confettiEl.appendChild(p);
    }
    confettiEl.classList.add('on');
    clearTimeout(confettiTimer);
    confettiTimer = setTimeout(() => { confettiEl.classList.remove('on'); confettiEl.innerHTML = ''; }, 5200);
  }

  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let konamiIdx = 0;
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    konamiIdx = k === KONAMI[konamiIdx] ? konamiIdx + 1 : (k === KONAMI[0] ? 1 : 0);
    if (konamiIdx === KONAMI.length) { konamiIdx = 0; dropConfetti(); }
  });

  // ═══ Screensaver (starfield) ═══

  const saverEl = document.getElementById('saver');
  const saverCanvas = document.getElementById('saver-canvas');
  let idleTimer, starsRaf = null, saverOn = false;

  function startStars() {
    const ctx = saverCanvas.getContext('2d');
    const W = saverCanvas.width = saverCanvas.offsetWidth;
    const H = saverCanvas.height = saverCanvas.offsetHeight;
    const N = 220;
    const stars = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * W,
      y: (Math.random() - 0.5) * H,
      z: Math.random() * W,
    }));
    const speed = 6;
    function frame() {
      if (!saverOn) { starsRaf = null; return; }
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.z -= speed;
        if (s.z <= 1) { s.x = (Math.random() - 0.5) * W; s.y = (Math.random() - 0.5) * H; s.z = W; }
        const k = 128 / s.z;
        const px = s.x * k + W / 2;
        const py = s.y * k + H / 2;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const depth = 1 - s.z / W;
        const size = Math.max(1, Math.round(depth * 3));
        const b = Math.round(120 + depth * 135);
        ctx.fillStyle = 'rgb(' + b + ',' + b + ',' + b + ')';
        ctx.fillRect(Math.round(px), Math.round(py), size, size);
      }
      starsRaf = requestAnimationFrame(frame);
    }
    starsRaf = requestAnimationFrame(frame);
  }

  function sleep() {
    if (saverOn) return;
    saverOn = true;
    saverEl.classList.add('on');
    startStars();
  }

  function resetIdle() {
    if (saverOn) {
      saverOn = false;
      saverEl.classList.remove('on');
      if (starsRaf) { cancelAnimationFrame(starsRaf); starsRaf = null; }
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(sleep, 45000);
  }

  saverEl.addEventListener('click', resetIdle);
  window.addEventListener('pointermove', resetIdle);
  window.addEventListener('pointerdown', resetIdle);
  window.addEventListener('keydown', resetIdle);
  resetIdle();

  renderAll();
})();
