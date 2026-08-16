/* FlashMaster UI — drives the on-screen handheld. All math-fact logic lives
 * in engine.js (window.FlashMaster); this file owns the LCD, the keys, the
 * timers, and the missed-problem memory in localStorage. */
(function () {
  'use strict';

  const FM = window.FlashMaster;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  if (params.has('embed')) document.body.classList.add('embed');
  const FEEDBACK_MS = params.has('fast') ? 60 : 700;
  const REVEAL_MS = params.has('fast') ? 90 : 1400;

  // Optional seeded RNG (?seed=n) so tests can script exact sessions.
  let rand = Math.random;
  if (params.get('seed') !== null) {
    let s = (Number(params.get('seed')) || 1) >>> 0;
    rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ═══ Persistent state ═══

  const store = {
    load(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    save(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    },
  };

  const settings = Object.assign(
    { op: '+', level: 3, timeIdx: 0, sound: true },
    store.load('fm-settings', {})
  );
  let specialBank = store.load('fm-special', []);

  // ═══ Device state ═══

  const S = {
    on: true,
    mode: 'idle',    // idle | session | results | off
    session: null,
    feedbackTimer: 0,
    tickTimer: 0,
  };

  // ═══ Sound (tiny WebAudio beeps, like the handheld's piezo) ═══

  let audioCtx = null;
  function beep(freq, ms, type) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { /* audio unavailable */ }
  }
  const clickBeep = () => beep(880, 30);
  const rightBeep = () => beep(1320, 90);
  const wrongBeep = () => beep(220, 180, 'sawtooth');

  // ═══ LCD ═══

  function lcd(status, main, sub) {
    $('lcd-status').textContent = status;
    $('lcd-main').textContent = main;
    $('lcd-sub').textContent = sub;
  }

  function timeLabel() {
    const t = FM.TIME_LIMITS[settings.timeIdx];
    return t === null ? 'TIME --' : 'TIME ' + t + 's';
  }

  function fmtClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function statusLine() {
    return settings.op + '  LEVEL ' + settings.level + '  ' + timeLabel();
  }

  function renderIdle(subText) {
    lcd(statusLine(), 'FLASHMASTER', subText || 'PRESS AN ACTIVITY KEY');
  }

  function activityLabel(id) {
    return FM.ACTIVITIES.find((a) => a.id === id).label;
  }

  function renderProblem() {
    const ss = S.session;
    const p = ss.queue[0];
    const entry = ss.entry === '' ? '_' : ss.entry;
    const left = ss.timed ? fmtClock(ss.timeLeft) : String(ss.done + 1) + '/' + ss.total;
    lcd(
      activityLabel(ss.activity) + '  ' + left,
      p.a + ' ' + p.op + ' ' + p.b + ' = ' + entry,
      ss.reveal ? 'ANSWER IS ' + p.answer + ' — KEY IT IN' : 'SCORE ' + ss.score
    );
  }

  /* The device ignores keys while feedback flashes; mirror that in the DOM
   * (a .busy class on the LCD) so tests and users can tell. */
  function setLock(v) {
    if (S.session) S.session.locked = v;
    $('lcd').classList.toggle('busy', v);
  }

  // ═══ Sessions ═══

  function startSession(activity) {
    if (activity === 'special' && specialBank.length === 0) {
      S.mode = 'idle';
      renderIdle('NO SPECIAL PROBLEMS — GO MISS SOME');
      return;
    }
    const built = FM.buildSession(activity, settings.op, settings.level, {
      rand, special: specialBank,
    });
    const limit = FM.TIME_LIMITS[settings.timeIdx];
    S.session = {
      activity,
      queue: built.problems.slice(),
      total: built.problems.length,
      done: 0,
      score: 0,        // first-try corrects
      firstTry: true,  // no miss yet on the current problem
      consecMiss: 0,
      reveal: false,
      entry: '',
      repeatMissed: built.repeatMissed,
      timed: built.timed && limit !== null,
      timeLeft: limit || 0,
      startedAt: Date.now(),
      locked: false,   // input frozen while feedback flashes
    };
    S.mode = 'session';
    setLock(false);
    if (S.session.timed) {
      S.tickTimer = setInterval(() => {
        S.session.timeLeft -= 1;
        if (S.session.timeLeft <= 0) return endSession(true);
        if (!S.session.locked) renderProblem();
      }, 1000);
    }
    renderProblem();
  }

  function stopTimers() {
    clearInterval(S.tickTimer);
    clearTimeout(S.feedbackTimer);
    S.tickTimer = 0;
    S.feedbackTimer = 0;
  }

  function endSession(timeUp) {
    const ss = S.session;
    stopTimers();
    S.mode = 'results';
    $('lcd').classList.remove('busy');
    const elapsed = (Date.now() - ss.startedAt) / 1000;
    const pct = ss.done ? Math.round((100 * ss.score) / ss.done) : 0;
    let sub;
    if (ss.activity === 'flashcards' && ss.done) {
      sub = (elapsed / ss.done).toFixed(1) + 's PER PROBLEM';
    } else {
      sub = pct + '%  ·  ' + fmtClock(elapsed);
    }
    lcd(
      timeUp ? "TIME'S UP!" : activityLabel(ss.activity) + ' DONE',
      'SCORE ' + ss.score + '/' + ss.done,
      sub + '  ·  PRESS AN ACTIVITY KEY'
    );
    beep(timeUp ? 330 : 1100, 250);
  }

  function advance() {
    const ss = S.session;
    ss.queue.shift();
    ss.done += 1;
    ss.firstTry = true;
    ss.consecMiss = 0;
    ss.reveal = false;
    ss.entry = '';
    if (ss.queue.length === 0) return endSession(false);
    setLock(false);
    renderProblem();
  }

  function flash(subText, then) {
    setLock(true);
    $('lcd-sub').textContent = subText;
    S.feedbackTimer = setTimeout(then, FEEDBACK_MS);
  }

  function commitEntry() {
    const ss = S.session;
    if (!ss || ss.locked || ss.entry === '') return;
    const p = ss.queue[0];
    const value = Number(ss.entry);

    if (value === p.answer) {
      rightBeep();
      if (ss.firstTry) ss.score += 1;
      if (ss.activity === 'special' && ss.firstTry) {
        specialBank = specialBank.filter((q) => q.a + q.op + q.b !== p.key);
        store.save('fm-special', specialBank);
      }
      flash('✓ RIGHT', advance);
      return;
    }

    wrongBeep();
    ss.firstTry = false;
    ss.consecMiss += 1;
    ss.entry = '';
    specialBank = FM.recordMiss(specialBank, p);
    store.save('fm-special', specialBank);

    if (!ss.repeatMissed) {
      // single-attempt activities show the answer briefly, then move on
      setLock(true);
      $('lcd-sub').textContent = '✗ ' + p.a + ' ' + p.op + ' ' + p.b + ' = ' + p.answer;
      S.feedbackTimer = setTimeout(advance, REVEAL_MS);
      return;
    }

    if (ss.consecMiss >= 2) {
      // two misses in a row: the device shows the answer and waits for it
      ss.reveal = true;
      flash('✗ WRONG', () => { setLock(false); renderProblem(); });
    } else {
      flash('✗ TRY AGAIN', () => { setLock(false); renderProblem(); });
    }
  }

  // ═══ Key handling ═══

  function pressDigit(d) {
    if (!S.on) return;
    clickBeep();
    if (S.mode !== 'session' || S.session.locked) return;
    const ss = S.session;
    ss.entry += d;
    const need = String(ss.queue[0].answer).length;
    renderProblem();
    if (ss.entry.length >= need) commitEntry();
  }

  function backspace() {
    if (!S.on || S.mode !== 'session' || S.session.locked) return;
    S.session.entry = S.session.entry.slice(0, -1);
    renderProblem();
  }

  function cancelToIdle(subText) {
    stopTimers();
    S.session = null;
    S.mode = 'idle';
    $('lcd').classList.remove('busy');
    renderIdle(subText);
  }

  function pressActivity(id) {
    if (!S.on) return;
    clickBeep();
    stopTimers();
    startSession(id);
  }

  function cycleSetting(mutate) {
    if (!S.on) return;
    clickBeep();
    mutate();
    store.save('fm-settings', settings);
    // changing a setting mid-session cancels it, like flipping the real switch
    cancelToIdle(S.mode === 'session' ? 'SESSION CANCELLED' : undefined);
  }

  function togglePower() {
    clickBeep();
    if (S.on) {
      S.on = false;
      S.mode = 'off';
      stopTimers();
      S.session = null;
      $('lcd').classList.remove('busy');
      lcd('', '', '');
      document.body.classList.add('powered-off');
    } else {
      S.on = true;
      S.mode = 'idle';
      document.body.classList.remove('powered-off');
      renderIdle();
    }
  }

  // ═══ Wiring ═══

  document.querySelectorAll('#activity-keys .activity').forEach((btn) => {
    btn.addEventListener('click', () => pressActivity(btn.dataset.activity));
  });
  document.querySelectorAll('#digit-keys .digit').forEach((btn) => {
    btn.addEventListener('click', () => pressDigit(btn.dataset.digit));
  });
  $('key-op').addEventListener('click', () => cycleSetting(() => {
    settings.op = FM.OPS[(FM.OPS.indexOf(settings.op) + 1) % FM.OPS.length];
  }));
  $('key-level').addEventListener('click', () => cycleSetting(() => {
    settings.level = (settings.level % 9) + 1;
  }));
  $('key-time').addEventListener('click', () => cycleSetting(() => {
    settings.timeIdx = (settings.timeIdx + 1) % FM.TIME_LIMITS.length;
  }));
  $('key-power').addEventListener('click', togglePower);

  const soundToggle = $('sound-toggle');
  soundToggle.checked = settings.sound;
  soundToggle.addEventListener('change', () => {
    settings.sound = soundToggle.checked;
    store.save('fm-settings', settings);
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { pressDigit(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
    else if (e.key === 'Enter') { commitEntry(); e.preventDefault(); }
  });

  renderIdle();
})();
