/*
 * Mahjong Trainer UI — lessons, the live game vs bots, and the coach.
 * All game math lives in engine.js (window.Mahjong).
 */
(() => {
  'use strict';

  const M = window.Mahjong;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  if (params.has('embed')) document.body.classList.add('embed');
  const SEED = params.get('seed');
  const BOT_DELAY = params.has('fast') ? 40 : 800;

  const SEATS = [
    { name: 'You', wind: 'East' },
    { name: 'Suki', wind: 'South' },
    { name: 'Wren', wind: 'West' },
    { name: 'Nori', wind: 'North' },
  ];

  // ═══ Tile rendering ═══

  const HONOR_CHARS = ['東', '南', '西', '北', '白', '發', '中'];
  const HONOR_SUBS = ['EAST', 'SOUTH', 'WEST', 'NORTH', 'WHITE', 'GREEN', 'RED'];
  const SUIT_GLYPHS = { m: '萬', p: '●', s: '‖' };

  function fillTile(el, t) {
    el.dataset.tile = t;
    el.title = M.tileName(t);
    const suit = M.suitOf(t);
    if (suit === 'z') {
      const h = t - 27;
      el.classList.add('h-' + HONOR_SUBS[h].charAt(0) + HONOR_SUBS[h].slice(1).toLowerCase());
      el.innerHTML = '<span class="t-big">' + HONOR_CHARS[h] + '</span><span class="t-sub">' + HONOR_SUBS[h] + '</span>';
    } else {
      el.classList.add('s-' + suit);
      el.innerHTML = '<span class="t-num">' + M.numOf(t) + '</span><span class="t-glyph">' + SUIT_GLYPHS[suit] + '</span>';
    }
    return el;
  }

  function tileSpan(t, small) {
    const el = document.createElement('span');
    el.className = 'tile' + (small ? ' small' : '');
    return fillTile(el, t);
  }

  function tileButton(t) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tile';
    return fillTile(el, t);
  }

  const tileHTML = (t, small) => tileSpan(t, small).outerHTML;
  const T = (t) => tileHTML(t, false);
  const ROW = (ids, extra) =>
    '<div class="tile-row">' + ids.map((x) => (x === '|' ? '<span class="sep"></span>' : T(x))).join('') + (extra || '') + '</div>';
  const NAME = (t) => '<strong>' + M.tileName(t) + '</strong>';

  // ═══ Tabs ═══

  const views = { learn: $('learn'), play: $('play') };
  const tabs = { learn: $('tab-learn'), play: $('tab-play') };
  function showView(which) {
    for (const k of Object.keys(views)) {
      views[k].hidden = k !== which;
      tabs[k].classList.toggle('active', k === which);
    }
  }
  tabs.learn.addEventListener('click', () => showView('learn'));
  tabs.play.addEventListener('click', () => {
    showView('play');
    if (!G) newGame();
  });

  // ═══════════════════════════════ LEARN MODE ═══════════════════════════════
  // m: 0-8, p: 9-17, s: 18-26, honors 27-33 (E S W N White Green Red)

  const LESSONS = [
    {
      title: 'Welcome to Mahjong',
      body: `
<p>Mahjong is a four-player game played with 136 tiles instead of cards. If you've ever played rummy, you already know the core idea: <strong>collect tiles that form groups</strong>.</p>
<div class="callout"><strong>The whole game in one sentence:</strong> be the first player to hold 14 tiles arranged as <strong>four sets of three</strong> plus <strong>one pair</strong>.</div>
<p>Here's a complete winning hand — three "runs", one "triplet", and a pair:</p>
${ROW([0, 1, 2, '|', 12, 13, 14, '|', 24, 25, 26, '|', 33, 33, 33, '|', 9, 9])}
<div class="caption">Runs of 1-2-3 and 4-5-6, a run of 7-8-9, three Red Dragons, and a pair of 1 Dots.</div>
<p>Each turn you draw one tile and throw one away, slowly sculpting 13 random tiles into that shape. That's it — everything else is detail, and the coach will walk you through all of it.</p>`,
    },
    {
      title: 'Meet the tiles',
      body: `
<p>There are 34 different tiles, and <strong>four copies of each</strong> (34 × 4 = 136). They come in two families:</p>
<h4>Number suits (1–9)</h4>
<table>
<tr><th>Suit</th><th>Looks like</th></tr>
<tr><td>Dots</td><td>${[9, 10, 11, 12, 13, 14, 15, 16, 17].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
<tr><td>Bamboo</td><td>${[18, 19, 20, 21, 22, 23, 24, 25, 26].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
<tr><td>Characters</td><td>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
</table>
<h4>Honor tiles (no numbers)</h4>
<p>Four <strong>winds</strong> and three <strong>dragons</strong>:</p>
${ROW([27, 28, 29, 30, '|', 31, 32, 33])}
<div class="caption">East, South, West, North — then the White, Green, and Red dragons.</div>
<div class="callout">Honors have no numbers, so they can <strong>never be part of a run</strong>. They only group as pairs or triplets of the exact same tile. Remember this — it drives a lot of strategy.</div>`,
    },
    {
      title: 'The three kinds of groups',
      body: `
<p>Every winning hand is built from exactly three shapes:</p>
<h4>1 · Run (chow) — three consecutive numbers, same suit</h4>
${ROW([12, 13, 14])}
<h4>2 · Triplet (pung) — three identical tiles</h4>
${ROW([29, 29, 29])}
<h4>3 · Pair — two identical tiles (you need exactly one)</h4>
${ROW([22, 22])}
<div class="callout">Two rules trip up every beginner: a run must be <strong>one single suit</strong> (4 Dots, 5 Bamboo, 6 Characters is not a run), and numbers <strong>don't wrap around</strong> — 8-9-1 is not a run.</div>
<div class="quiz">
  <div class="q">Pop quiz: which of these is a valid run?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="1" data-fb="Yes! Three consecutive Dots — a perfect run.">${[12, 13, 14].map((t) => tileHTML(t, true)).join('')}</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="Consecutive numbers, but three different suits — a run must stay in one suit.">${[3, 13, 23].map((t) => tileHTML(t, true)).join('')}</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="Numbers don't wrap around: 8-9-1 is never a run.">${[25, 26, 18].map((t) => tileHTML(t, true)).join('')}</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'How a turn works',
      body: `
<p>Everyone starts with 13 tiles. The rest form the <strong>wall</strong> — the face-down draw pile. Play moves counterclockwise: East → South → West → North.</p>
<p>On your turn you do exactly two things:</p>
<table>
<tr><th>1 · Draw</th><td>Take one tile from the wall. You now hold 14.</td></tr>
<tr><th>2 · Discard</th><td>If those 14 tiles aren't a winning hand, throw one face-up into the middle. You're back to 13.</td></tr>
</table>
<p>Discards stay face-up in front of each player, so you can see what everyone has thrown — useful intel later.</p>
<div class="callout">Between turns you <strong>always hold 13 tiles</strong>. Draw to 14, discard back to 13. If nobody wins before the wall runs out, the round is a draw.</div>
<div class="quiz">
  <div class="q">You just drew a tile and can't win yet. How many tiles will you hold after your discard?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="0" data-fb="Not quite — 14 is only while you're deciding what to throw.">14</button>
    <button type="button" class="q-opt" data-ok="1" data-fb="Right — 13 between turns, every time.">13</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="Nope — you never drop below 13 (unless you've made calls, more on that next).">12</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'Calls: stealing discards',
      body: `
<p>Here's what makes mahjong exciting: when <em>someone else</em> discards a tile you need, you can shout and <strong>take it</strong>.</p>
<table>
<tr><th>Pung</th><td>You hold two identical tiles and someone discards the third. Take it from <strong>anyone</strong>.</td></tr>
<tr><th>Chow</th><td>The discard completes a run for you — but only from the player <strong>on your left</strong> (the one who plays just before you).</td></tr>
<tr><th>Kong</th><td>You hold three identical and the fourth appears (or you draw all four). You reveal them and draw a bonus replacement tile.</td></tr>
<tr><th>Win!</th><td>The discard completes your whole hand. This beats every other call — it's called <strong>ron</strong>.</td></tr>
</table>
<p>Example: you hold ${tileHTML(14, true)} ${tileHTML(15, true)} and Nori discards ${tileHTML(16, true)} — you can call "chow", take it, and lay the run face-up.</p>
<div class="callout"><strong>The catch:</strong> called sets are placed face-up on the table. They still count toward your four sets, but everyone can now read part of your hand, and the tiles are locked — you can't reshuffle them later. Calls speed you up at the price of flexibility. After any call, you skip drawing and just discard.</div>
<p>If two players want the same discard: Win beats Pung/Kong, which beat Chow.</p>`,
    },
    {
      title: 'Being "ready" and winning',
      body: `
<p>When your hand needs just <strong>one more tile</strong> to be complete, you are <strong>ready</strong> (Japanese players say <em>tenpai</em>). This is the moment to watch the table like a hawk.</p>
<p>You win in one of two ways:</p>
<table>
<tr><th>Ron</th><td>Someone discards your winning tile — you claim it and reveal your hand.</td></tr>
<tr><th>Tsumo</th><td>You draw the winning tile yourself. A touch more glorious.</td></tr>
</table>
<p>Example of a ready hand (13 tiles):</p>
${ROW([0, 1, 2, '|', 12, 13, 14, '|', 24, 25, 26, '|', 13, 13, '|', 4, 5])}
<div class="caption">Three finished runs, a pair of 5 Dots, and 5-6 Characters waiting for a 4 or 7 of Characters.</div>
<div class="quiz">
  <div class="q">That hand above — which tile completes it?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="1" data-fb="Yes — 4 Characters finishes the 4-5-6 run. (7 Characters works too: two ways to win!)">${tileHTML(3, true)}</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="The 5 Dots pair is already done — a third would break the shape.">${tileHTML(13, true)}</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="A lone wind pairs with nothing here — it can't complete anything.">${tileHTML(29, true)}</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'Strategy 101: what do I throw away?',
      body: `
<p>Ninety percent of mahjong skill is choosing your discard. Three beginner principles carry you a long way:</p>
<h4>1 · Ditch lonely honors first</h4>
<p>A single wind or dragon like ${tileHTML(30, true)} can only ever pair with its two remaining twins — it can't join a run. If it hasn't found a partner early, let it go.</p>
<h4>2 · Keep tiles that work together</h4>
<p>${tileHTML(14, true)} ${tileHTML(15, true)} is one tile away from a run. A middle tile like a 5 can extend both directions; a 1 or 9 only extends one way. Middle tiles &gt; edge tiles &gt; loners.</p>
<h4>3 · Count your "improving tiles"</h4>
<p>Before discarding, ask: <em>how many different tiles would move me closer to winning?</em> The discard that leaves the most live possibilities is usually best. This number is exactly what the coach computes for you in play mode.</p>
<div class="callout">The coach measures your hand in <strong>"steps from ready"</strong> (players call this <em>shanten</em>). Ready = 0 steps. Each good exchange takes you down one step. A fresh deal usually starts 3–4 steps out.</div>`,
    },
    {
      title: "You're ready to play",
      body: `
<p>Time for a real game against three bots — Suki, Wren, and Nori. You're East, so you go first.</p>
<h4>What you'll see</h4>
<table>
<tr><th>Your hand</th><td>Big tiles at the bottom. On your turn, <strong>click a tile to discard it</strong>. The ★ marks the coach's pick.</td></tr>
<tr><th>Coach panel</th><td>Every turn: what phase you're in, what you can do, the best move, and <em>why</em>. Toggle it off any time to test yourself.</td></tr>
<tr><th>Gold panel</th><td>Appears when you can call Pung / Chow / Kong / Win on someone's discard — with advice on whether it's worth it.</td></tr>
<tr><th>Buttons</th><td><strong>Tsumo</strong> appears when you've drawn your winning tile, <strong>Kong</strong> when you hold four of a kind. When in doubt, the coach will say.</td></tr>
</table>
<p>Don't worry about scoring yet — first goal: just <em>complete a hand</em>. The win screen will point out any classic patterns you happened to make.</p>
<p><button type="button" class="pixel-btn" id="start-guided">▶ Start your first game</button></p>`,
    },
  ];

  let lessonIdx = 0;
  const lessonBody = $('lesson-body');

  function renderLesson() {
    const l = LESSONS[lessonIdx];
    $('lesson-kicker').textContent = 'LESSON ' + (lessonIdx + 1) + ' OF ' + LESSONS.length;
    $('lesson-title').textContent = l.title;
    lessonBody.innerHTML = l.body;
    $('lesson-prev').disabled = lessonIdx === 0;
    $('lesson-next').disabled = lessonIdx === LESSONS.length - 1;
    const dots = $('lesson-dots');
    dots.innerHTML = '';
    LESSONS.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot' + (i === lessonIdx ? ' on' : '');
      d.title = 'Lesson ' + (i + 1);
      d.addEventListener('click', () => { lessonIdx = i; renderLesson(); });
      dots.appendChild(d);
    });
    $('lesson-card').scrollTop = 0;
    const start = $('start-guided');
    if (start) start.addEventListener('click', () => { showView('play'); newGame(); });
  }

  $('lesson-prev').addEventListener('click', () => { if (lessonIdx > 0) { lessonIdx--; renderLesson(); } });
  $('lesson-next').addEventListener('click', () => { if (lessonIdx < LESSONS.length - 1) { lessonIdx++; renderLesson(); } });

  // quiz answers
  lessonBody.addEventListener('click', (e) => {
    const opt = e.target.closest('.q-opt');
    if (!opt) return;
    const quiz = opt.closest('.quiz');
    const good = opt.dataset.ok === '1';
    quiz.querySelectorAll('.q-opt').forEach((o) => o.classList.remove('right', 'wrong'));
    opt.classList.add(good ? 'right' : 'wrong');
    const fb = quiz.querySelector('.q-fb');
    fb.textContent = (good ? '✓ ' : '✗ ') + opt.dataset.fb;
    fb.className = 'q-fb ' + (good ? 'good' : 'bad');
  });

  renderLesson();

  // ═══════════════════════════════ PLAY MODE ═══════════════════════════════

  let G = null;          // game state
  let coachOn = true;
  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

  function newGame() {
    clearTimers();
    $('mj-dialog').hidden = true;
    $('call-bar').hidden = true;
    const seed = SEED !== null ? Number(SEED) : Math.floor(Math.random() * 1e9);
    const rand = M.rng(seed);
    const wall = M.buildWall(rand);
    const hands = [[], [], [], []];
    for (let i = 0; i < 13; i++) for (let p = 0; p < 4; p++) hands[p].push(wall.pop());
    hands.forEach((h) => h.sort((a, b) => a - b));
    G = {
      wall, hands,
      melds: [[], [], [], []],
      discards: [[], [], [], []],
      turn: 0,
      phase: 'dealing',    // 'discard' (a player must discard), 'calls' (waiting on a claim), 'over'
      lastDraw: null,
      lastDiscard: null,   // {p, tile}
      pending: null,       // human call decision in progress
      over: false,
    };
    startTurn(0);
  }

  const meldCount = (p) => G.melds[p].length;

  // Tiles a seat cannot see: 4 of each, minus its own hand, all discards,
  // and every face-up meld. Bots and the coach use the same information.
  function unseenFor(p) {
    const u = new Array(34).fill(4);
    for (const t of G.hands[p]) u[t]--;
    for (let q = 0; q < 4; q++) {
      for (const t of G.discards[q]) u[t]--;
      for (const m of G.melds[q]) for (const t of m.tiles) u[t]--;
    }
    if (G.lastDiscard && G.pending) u[G.lastDiscard.tile]--;
    return u;
  }

  // ── Turn flow ──

  function startTurn(p) {
    if (G.over) return;
    if (G.wall.length === 0) return endDraw();
    G.turn = p;
    const t = G.wall.pop();
    G.lastDraw = t;
    G.hands[p].push(t);
    G.phase = 'discard';
    if (p === 0) {
      render();
    } else {
      render();
      later(() => botTurn(p), BOT_DELAY);
    }
  }

  function botTurn(p) {
    if (G.over) return;
    if (M.isWinningHand(G.hands[p], meldCount(p))) return endWin(p, G.lastDraw, 'tsumo', null);
    const rows = M.evaluateDiscards(G.hands[p], meldCount(p), unseenFor(p));
    doDiscard(p, rows[0].tile);
  }

  function doDiscard(p, tile) {
    const i = G.hands[p].indexOf(tile);
    G.hands[p].splice(i, 1);
    G.hands[p].sort((a, b) => a - b);
    G.discards[p].push(tile);
    G.lastDiscard = { p, tile };
    G.lastDraw = null;
    resolveCalls(p, tile);
  }

  // ── Calls on a discard ──

  function botClaim(q, p, tile) {
    const hand = G.hands[q];
    if (M.isWinningHand(hand.concat(tile), meldCount(q))) return { type: 'ron' };
    const before = M.shanten(hand, meldCount(q));
    const c = M.counts(hand);
    const tryClaim = (used) => {
      const rest = hand.slice();
      for (const u of used) rest.splice(rest.indexOf(u), 1);
      const rows = M.evaluateDiscards(rest, meldCount(q) + 1, unseenFor(q));
      return rows.length ? rows[0].shanten : 9;
    };
    if (c[tile] >= 2 && tryClaim([tile, tile]) < before) return { type: 'pung' };
    if (q === (p + 1) % 4) {
      for (const opt of M.chowOptions(hand, tile)) {
        if (tryClaim(opt) < before) return { type: 'chow', opt };
      }
    }
    return null;
  }

  function humanOptions(p, tile) {
    if (p === 0) return null;
    const hand = G.hands[0];
    const c = M.counts(hand);
    const opts = {
      ron: M.isWinningHand(hand.concat(tile), meldCount(0)),
      pung: c[tile] >= 2,
      kong: c[tile] === 3 && G.wall.length > 0,
      chows: (p + 1) % 4 === 0 ? M.chowOptions(hand, tile) : [],
    };
    if (!opts.ron && !opts.pung && !opts.kong && opts.chows.length === 0) return null;
    return opts;
  }

  function resolveCalls(p, tile) {
    const claims = [];
    for (let q = 1; q < 4; q++) {
      if (q === p) continue;
      const cl = botClaim(q, p, tile);
      if (cl) claims.push({ q, ...cl });
    }
    const human = humanOptions(p, tile);
    if (human) {
      G.phase = 'calls';
      G.pending = { p, tile, human, claims };
      render();
      showCallBar(p, tile, human);
      return;
    }
    finishCalls(p, tile, claims, null);
  }

  function finishCalls(p, tile, claims, humanChoice) {
    G.pending = null;
    $('call-bar').hidden = true;
    const all = claims.slice();
    if (humanChoice) all.push({ q: 0, ...humanChoice });
    const prio = (c) => (c.type === 'ron' ? 3 : c.type === 'pung' || c.type === 'kong' ? 2 : 1);
    all.sort((a, b) => prio(b) - prio(a) || (a.q === 0 ? -1 : b.q === 0 ? 1 : 0));
    const win = all[0];
    if (!win) { later(() => startTurn((p + 1) % 4), G.over ? 0 : Math.min(BOT_DELAY, 300)); return; }

    const q = win.q;
    if (win.type === 'ron') return endWin(q, tile, 'ron', p);

    // the claimed tile leaves the discarder's row and joins a face-up meld
    G.discards[p].pop();
    G.lastDiscard = null;
    const hand = G.hands[q];
    const take = (x) => hand.splice(hand.indexOf(x), 1);

    if (win.type === 'pung') {
      take(tile); take(tile);
      G.melds[q].push({ type: 'pung', tiles: [tile, tile, tile], open: true });
    } else if (win.type === 'kong') {
      take(tile); take(tile); take(tile);
      G.melds[q].push({ type: 'kong', tiles: [tile, tile, tile, tile], open: true });
      if (G.wall.length === 0) return endDraw();
      const rep = G.wall.pop();
      G.hands[q].push(rep);
      G.lastDraw = rep;
    } else if (win.type === 'chow') {
      win.opt.forEach(take);
      G.melds[q].push({ type: 'chow', tiles: win.opt.concat(tile).sort((a, b) => a - b), open: true });
    }
    hand.sort((a, b) => a - b);
    G.turn = q;
    G.phase = 'discard';
    G.justCalled = win.type;
    render();
    if (q === 0) {
      if (win.type === 'kong' && M.isWinningHand(G.hands[0], meldCount(0))) render();
    } else {
      later(() => botTurn(q), BOT_DELAY);
    }
  }

  // ── Human call UI ──

  const shantenWord = (s) =>
    s <= -1 ? 'a complete hand' : s === 0 ? 'ready (one tile from winning)' : s + (s === 1 ? ' step' : ' steps') + ' from ready';

  function callAdvice(tile, human) {
    if (!coachOn) return '';
    if (human.ron) return '<strong>Coach:</strong> that tile completes your hand — call the win. Always take a win.';
    const before = M.shanten(G.hands[0], meldCount(0));
    const bits = [];
    const tryAfter = (used) => {
      const rest = G.hands[0].slice();
      for (const u of used) rest.splice(rest.indexOf(u), 1);
      const rows = M.evaluateDiscards(rest, meldCount(0) + 1, unseenFor(0));
      return rows.length ? rows[0].shanten : 9;
    };
    let bestGain = null;
    if (human.pung) {
      const after = tryAfter([tile, tile]);
      if (after < before) bestGain = { label: 'Pung', after };
    }
    if (human.kong) {
      const after = tryAfter([tile, tile, tile]);
      if (after <= before && (bestGain === null || after < bestGain.after)) bestGain = { label: 'Kong', after };
    }
    for (const opt of human.chows) {
      const after = tryAfter(opt);
      if (after < before && (bestGain === null || after < bestGain.after)) bestGain = { label: 'Chow', after };
    }
    if (bestGain) {
      bits.push('<strong>Coach:</strong> calling <strong>' + bestGain.label + '</strong> moves you from ' +
        shantenWord(before) + ' to ' + shantenWord(bestGain.after) +
        '. Worth it — just remember the set locks face-up.');
    } else {
      bits.push('<strong>Coach:</strong> skip this one. Calling wouldn’t bring you closer to winning (you’re ' +
        shantenWord(before) + ' either way), and it would lock tiles face-up and reveal your plans.');
    }
    return bits.join(' ');
  }

  function showCallBar(p, tile, human) {
    const bar = $('call-bar');
    const txt = $('call-text');
    const btns = $('call-buttons');
    txt.innerHTML = SEATS[p].name + ' (' + SEATS[p].wind + ') discarded ' + tileHTML(tile, true) + ' ' + NAME(tile) +
      ' — you can claim it.<br>' + callAdvice(tile, human);
    btns.innerHTML = '';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pixel-btn ' + cls;
      b.innerHTML = label;
      b.addEventListener('click', fn);
      btns.appendChild(b);
      return b;
    };
    if (human.ron) mk('WIN! (ron)', 'win-call', () => finishCalls(p, tile, G.pending.claims, { type: 'ron' }));
    if (human.pung) mk('Pung', 'shout', () => finishCalls(p, tile, G.pending.claims, { type: 'pung' }));
    if (human.kong) mk('Kong', 'shout', () => finishCalls(p, tile, G.pending.claims, { type: 'kong' }));
    human.chows.forEach((opt) => {
      const wrap = document.createElement('span');
      wrap.className = 'call-opt';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pixel-btn shout';
      b.innerHTML = 'Chow ' + opt.map((t) => tileHTML(t, true)).join('');
      b.addEventListener('click', () => finishCalls(p, tile, G.pending.claims, { type: 'chow', opt }));
      wrap.appendChild(b);
      btns.appendChild(wrap);
    });
    mk('Skip', '', () => finishCalls(p, tile, G.pending.claims, null));
    bar.hidden = false;
  }

  // ── Endings ──

  function endWin(q, winTile, method, fromSeat) {
    G.over = true;
    G.phase = 'over';
    clearTimers();
    $('call-bar').hidden = true;
    const all = G.hands[q].slice();
    for (const m of G.melds[q]) all.push(...m.tiles);
    const patterns = M.winPatterns(all, method, q);
    const you = q === 0;
    const title = you ? '🎉 You win!' : SEATS[q].name + ' wins';
    const how = method === 'tsumo'
      ? (you ? 'You drew your own winning tile — a tsumo.' : SEATS[q].name + ' drew the winning tile (tsumo).')
      : (you ? 'You claimed ' + M.tileName(winTile) + ' from ' + SEATS[fromSeat].name + ' — a ron.'
             : SEATS[q].name + ' claimed ' + (fromSeat === 0 ? 'your' : SEATS[fromSeat].name + '’s') + ' discarded ' + M.tileName(winTile) + ' (ron).');
    let body = '<p>' + how + '</p><div class="tile-row">' +
      G.hands[q].map((t) => tileHTML(t, true)).join('') +
      G.melds[q].map((m) => ' &nbsp;' + m.tiles.map((t) => tileHTML(t, true)).join('')).join('') +
      '</div>';
    if (patterns.length) body += '<p><strong>Patterns in this hand:</strong></p><ul>' + patterns.map((s) => '<li>' + s + '</li>').join('') + '</ul>';
    else body += '<p>No bonus patterns — a plain "chicken hand", but a win is a win!</p>';
    if (!you && coachOn) body += '<p>Watch their revealed hand above — spotting the shape of finished hands is how you learn to read the table.</p>';
    showDialog(title, body);
    render();
  }

  function endDraw() {
    G.over = true;
    G.phase = 'over';
    clearTimers();
    $('call-bar').hidden = true;
    showDialog('Wall empty — draw',
      '<p>Nobody completed a hand before the tiles ran out. That happens! Hands that chase too many maybes stall out — next round, try calling Pung or Chow to speed up.</p>');
    render();
  }

  function showDialog(title, bodyHTML) {
    $('mj-dialog-title').innerHTML = title;
    $('mj-dialog-body').innerHTML = bodyHTML;
    $('mj-dialog').hidden = false;
  }
  $('mj-dialog-btn').addEventListener('click', () => { $('mj-dialog').hidden = true; newGame(); });

  // ── Coach ──

  function discardReason(reco, second, hand) {
    const t = reco.tile;
    const c = M.counts(hand);
    if (M.isHonor(t) && c[t] === 1) {
      return 'A lone honor tile — it can’t join a run, so it only ever pairs with itself. Cut it while it’s cheap.';
    }
    if (!M.isHonor(t)) {
      const n = M.numOf(t);
      const s = Math.floor(t / 9) * 9;
      let neighbors = 0;
      for (let d = -2; d <= 2; d++) {
        const x = t + d;
        if (d !== 0 && x >= s && x < s + 9 && n + d >= 1 && n + d <= 9) neighbors += c[x];
      }
      if (neighbors === 0 && c[t] === 1) {
        return M.isTerminal(t)
          ? 'An isolated ' + (n === 1 ? '1' : '9') + ' — terminals only extend in one direction, and nothing in your hand connects to it.'
          : 'It’s isolated — nothing in your hand is within two of it, so it isn’t building toward anything.';
      }
    }
    let s = 'Everything in your hand connects somewhere, so drop what costs least: this keeps ' + reco.ukeire + ' improving tiles in play';
    if (second && second.ukeire < reco.ukeire) s += ' (the next-best discard keeps only ' + second.ukeire + ')';
    else if (second && second.shanten === reco.shanten && second.ukeire === reco.ukeire) s += ' — a few discards are equally fine here, so any of them works';
    return s + '.';
  }

  function coachHTML() {
    if (!G) return '';
    if (G.over) return '<div class="co-phase">Game over.</div><div>Hit <strong>New game</strong> to deal again — repetition is how the shapes start jumping out at you.</div>';

    if (G.pending) {
      return '<div class="co-phase">Decision: someone discarded a tile you can use.</div>' +
        '<div>Check the gold panel — it lists every call you’re allowed to make right now' + (coachOn ? ', with my advice' : '') + '.</div>';
    }

    if (G.turn !== 0) {
      return '<div class="co-phase">' + SEATS[G.turn].name + ' (' + SEATS[G.turn].wind + ') is taking their turn…</div>' +
        '<div>They draw one tile and discard one, same as you. Watch their discards — every thrown tile is information about what they <em>don’t</em> need.</div>';
    }

    // your discard phase
    const hand = G.hands[0];
    const mc = meldCount(0);
    const drewLine = G.lastDraw !== null
      ? 'You drew ' + tileHTML(G.lastDraw, true) + ' ' + NAME(G.lastDraw) + '.'
      : 'You called a tile — no draw, just discard one.';

    if (M.isWinningHand(hand, mc)) {
      return '<div class="co-phase">' + drewLine + '</div>' +
        '<div class="co-win">Your hand is complete — four sets and a pair! Press TSUMO to declare the win.</div>';
    }

    if (!coachOn) {
      return '<div class="co-phase">' + drewLine + '</div><div>Your turn — click a tile to discard it. (Coach is off — you’re flying solo.)</div>';
    }

    const rows = M.evaluateDiscards(hand, mc, unseenFor(0));
    const reco = rows[0];
    const second = rows[1];
    let html = '<div class="co-phase">' + drewLine + ' Now discard one tile — click it.</div>';
    html += '<div class="co-reco">Best discard: <strong>' + M.tileName(reco.tile) + '</strong> ' + tileHTML(reco.tile, true) +
      ' — that leaves you <strong>' + shantenWord(reco.shanten) + '</strong>.</div>';
    html += '<div class="co-why">Why: ' + discardReason(reco, second, hand) + '</div>';
    if (reco.tiles.length) {
      const shown = reco.tiles.slice(0, 9);
      html += '<div class="co-tiles"><span class="lead">' + reco.ukeire + ' tiles still out there improve you:</span>' +
        shown.map((x) => tileHTML(x.tile, true)).join('') + (reco.tiles.length > shown.length ? ' …' : '') + '</div>';
    }
    const kongable = M.counts(hand).findIndex((n) => n === 4);
    if (kongable !== -1 && G.wall.length > 0) {
      html += '<div class="co-why">You hold all four ' + M.tileName(kongable) + ' — you may declare a <strong>Kong</strong> for a bonus draw.</div>';
    }
    return html;
  }

  // ── Rendering ──

  function render() {
    if (!G) return;
    $('wall-count').textContent = 'Wall: ' + G.wall.length + ' tiles';

    // opponents
    const opps = $('opponents');
    opps.innerHTML = '';
    for (let p = 1; p < 4; p++) {
      const row = document.createElement('div');
      row.className = 'opp' + (G.turn === p && !G.over ? ' active' : '');
      row.id = 'opp-' + p;
      const head = document.createElement('div');
      head.className = 'opp-head';
      const name = document.createElement('span');
      name.className = 'opp-name';
      name.textContent = (G.turn === p && !G.over ? '▸ ' : '') + SEATS[p].name + ' · ' + SEATS[p].wind;
      head.appendChild(name);
      const backs = document.createElement('span');
      backs.className = 'opp-backs';
      for (let i = 0; i < G.hands[p].length; i++) {
        const b = document.createElement('span');
        b.className = 'tile back';
        backs.appendChild(b);
      }
      head.appendChild(backs);
      const melds = document.createElement('span');
      melds.className = 'opp-melds';
      for (const m of G.melds[p]) {
        const g = document.createElement('span');
        g.className = 'meld';
        m.tiles.forEach((t) => g.appendChild(tileSpan(t, true)));
        melds.appendChild(g);
      }
      head.appendChild(melds);
      row.appendChild(head);
      const river = document.createElement('div');
      river.className = 'river';
      G.discards[p].forEach((t, i) => {
        const el = tileSpan(t, true);
        if (G.lastDiscard && G.lastDiscard.p === p && i === G.discards[p].length - 1) el.classList.add('just-discarded');
        river.appendChild(el);
      });
      row.appendChild(river);
      opps.appendChild(row);
    }

    // your river
    $('your-river-row').classList.toggle('active', G.turn === 0 && !G.over);
    const r0 = $('river-0');
    r0.innerHTML = '';
    G.discards[0].forEach((t, i) => {
      const el = tileSpan(t, true);
      if (G.lastDiscard && G.lastDiscard.p === 0 && i === G.discards[0].length - 1) el.classList.add('just-discarded');
      r0.appendChild(el);
    });

    // your melds
    const pm = $('player-melds');
    pm.innerHTML = '';
    for (const m of G.melds[0]) {
      const g = document.createElement('span');
      g.className = 'meld';
      m.tiles.forEach((t) => g.appendChild(tileSpan(t, true)));
      pm.appendChild(g);
    }

    // your hand
    const handEl = $('hand');
    handEl.innerHTML = '';
    const yourTurn = G.turn === 0 && G.phase === 'discard' && !G.over && !G.pending;
    let recoTile = null;
    if (yourTurn && coachOn && !M.isWinningHand(G.hands[0], meldCount(0))) {
      recoTile = M.evaluateDiscards(G.hands[0], meldCount(0), unseenFor(0))[0].tile;
    }
    let recoMarked = false;
    G.hands[0].forEach((t) => {
      const b = tileButton(t);
      b.disabled = !yourTurn;
      if (t === recoTile && !recoMarked) { b.classList.add('reco'); recoMarked = true; }
      b.addEventListener('click', () => onHandClick(t));
      handEl.appendChild(b);
    });

    // action buttons
    const actions = $('hand-actions');
    actions.innerHTML = '';
    if (yourTurn) {
      if (M.isWinningHand(G.hands[0], meldCount(0))) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pixel-btn win-call';
        b.id = 'tsumo-btn';
        b.textContent = 'TSUMO — declare win!';
        b.addEventListener('click', () => endWin(0, G.lastDraw, 'tsumo', null));
        actions.appendChild(b);
      }
      const c = M.counts(G.hands[0]);
      for (let t = 0; t < 34; t++) {
        if (c[t] === 4 && G.wall.length > 0) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pixel-btn';
          b.innerHTML = 'Kong ' + tileHTML(t, true);
          b.addEventListener('click', () => declareClosedKong(t));
          actions.appendChild(b);
        }
      }
    }

    // coach
    $('coach').classList.toggle('coach-off', !coachOn);
    $('coach-body').innerHTML = coachHTML();
  }

  function onHandClick(t) {
    if (!G || G.over || G.pending || G.turn !== 0 || G.phase !== 'discard') return;
    if (coachOn && !M.isWinningHand(G.hands[0], meldCount(0))) {
      const rows = M.evaluateDiscards(G.hands[0], meldCount(0), unseenFor(0));
      const reco = rows[0];
      const chosen = rows.find((r) => r.tile === t);
      if (chosen && chosen.tile !== reco.tile) {
        if (chosen.shanten > reco.shanten) {
          toast('That set you back a step — ' + M.tileName(reco.tile) + ' kept you ' + shantenWord(reco.shanten) + '.');
        } else if (reco.ukeire > chosen.ukeire) {
          toast('Playable — but ' + M.tileName(reco.tile) + ' kept ' + reco.ukeire + ' improving tiles vs your ' + chosen.ukeire + '.');
        } else {
          toast('Just as good as the coach’s pick. Nice.');
        }
      }
    }
    doDiscard(0, t);
  }

  function declareClosedKong(t) {
    const hand = G.hands[0];
    for (let i = 0; i < 4; i++) hand.splice(hand.indexOf(t), 1);
    G.melds[0].push({ type: 'kong', tiles: [t, t, t, t], open: false });
    if (G.wall.length === 0) return endDraw();
    const rep = G.wall.pop();
    hand.push(rep);
    hand.sort((a, b) => a - b);
    G.lastDraw = rep;
    render();
  }

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  $('new-game').addEventListener('click', newGame);
  $('coach-toggle').addEventListener('change', (e) => { coachOn = e.target.checked; render(); });

  // ── boot ──

  if (params.get('mode') === 'play') {
    showView('play');
    newGame();
  }

  // Test hook: lets Playwright observe game state without scraping the DOM.
  window.__mj = {
    get state() {
      if (!G) return null;
      return {
        turn: G.turn,
        phase: G.phase,
        over: G.over,
        pending: !!G.pending,
        wall: G.wall.length,
        handSizes: G.hands.map((h) => h.length),
        discardCounts: G.discards.map((d) => d.length),
      };
    },
    newGame,
  };
})();
