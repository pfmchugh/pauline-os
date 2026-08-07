/*
 * Mahjong Trainer UI — American Mah Jongg: lessons, the Charleston, a live
 * game vs bots, and a coach. All game math lives in engine.js (window.Mahjong).
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

  const WIND_CHARS = ['東', '南', '西', '北'];
  const WIND_SUBS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
  const SUIT_GLYPHS = { m: '萬', p: '●', s: '‖' };

  function fillTile(el, t) {
    el.dataset.tile = t;
    el.title = M.tileName(t);
    if (t === M.JOKER) {
      el.classList.add('h-Joker');
      el.innerHTML = '<span class="t-big">J</span><span class="t-sub">JOKER</span>';
    } else if (t === M.FLOWER) {
      el.classList.add('h-Flower');
      el.innerHTML = '<span class="t-big">✿</span><span class="t-sub">FLOWER</span>';
    } else if (t === M.SOAP) {
      el.classList.add('h-White');
      el.innerHTML = '<span class="t-big">白</span><span class="t-sub">SOAP</span>';
    } else if (t === M.GREEN) {
      el.classList.add('h-Green');
      el.innerHTML = '<span class="t-big">發</span><span class="t-sub">GREEN</span>';
    } else if (t === M.RED) {
      el.classList.add('h-Red');
      el.innerHTML = '<span class="t-big">中</span><span class="t-sub">RED</span>';
    } else if (t >= M.EAST) {
      el.classList.add('h-East');
      el.innerHTML = '<span class="t-big">' + WIND_CHARS[t - M.EAST] + '</span><span class="t-sub">' + WIND_SUBS[t - M.EAST] + '</span>';
    } else {
      const suit = M.suitOf(t);
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

  // ═══ Card notation display ═══
  // Roles: r1/r2/r3 = first/second/third suit in the hand, n = neutral, f = flowers.

  const CARD_TOKENS = {
    'like-numbers': [['FF', 'f'], ['1111', 'r1'], ['1111', 'r2'], ['1111', 'r3']],
    'evens-run': [['222', 'r1'], ['444', 'r1'], ['6666', 'r2'], ['8888', 'r2']],
    'evens-dragons': [['22', 'r1'], ['44', 'r1'], ['666', 'r1'], ['888', 'r1'], ['DDDD', 'r1']],
    'consec-kongs': [['111', 'r1'], ['2222', 'r1'], ['333', 'r1'], ['4444', 'r1']],
    'consec-climb': [['11', 'r1'], ['22', 'r1'], ['333', 'r1'], ['444', 'r1'], ['5555', 'r1']],
    'odds-135': [['11', 'r1'], ['333', 'r1'], ['5555', 'r1'], ['777', 'r1'], ['99', 'r1']],
    'odds-heavy-nine': [['111', 'r1'], ['33', 'r1'], ['555', 'r1'], ['77', 'r1'], ['9999', 'r1']],
    'winds-dragons': [['EEE', 'n'], ['SSS', 'n'], ['WWW', 'n'], ['NNN', 'n'], ['DD', 'n']],
    'three-six-nine': [['3333', 'r1'], ['6666', 'r2'], ['9999', 'r3'], ['DD', 'n']],
    'quints': [['FFFF', 'f'], ['11111', 'r1'], ['11111', 'r2']],
    'seven-pairs': [['11', 'r1'], ['22', 'r1'], ['33', 'r1'], ['44', 'r1'], ['55', 'r1'], ['66', 'r1'], ['77', 'r1']],
  };

  function notationHTML(hand) {
    const toks = CARD_TOKENS[hand.id] || [[hand.notation, 'n']];
    return toks.map(([txt, cls]) => '<span class="cn ' + cls + '">' + txt + '</span>').join(' ');
  }

  function cardTableHTML(withBadges, needs) {
    let html = '<div class="card-sheet">';
    let lastCat = '';
    M.CARD.forEach((hand, i) => {
      if (hand.cat !== lastCat) {
        lastCat = hand.cat;
        html += '<div class="card-cat pixel">' + hand.cat.toUpperCase() + '</div>';
      }
      const badge = withBadges
        ? (needs && needs.has(i)
          ? '<span class="card-badge' + (needs.get(i).rank === 0 ? ' best' : '') + '">' + needs.get(i).need + ' away</span>'
          : '<span class="card-badge dead">—</span>')
        : '';
      html += '<div class="card-hand' + (withBadges && needs && needs.has(i) && needs.get(i).rank === 0 ? ' target' : '') + '">' +
        '<span class="card-notation">' + notationHTML(hand) + '</span>' +
        '<span class="card-pts pixel">' + hand.points + '</span>' + badge +
        '<div class="card-note">' + hand.note + (hand.concealed ? ' <em>(concealed)</em>' : '') + '</div>' +
        '</div>';
    });
    return html + '</div>';
  }

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

  const F = M.FLOWER, J = M.JOKER;

  const LESSONS = [
    {
      title: 'Welcome to American Mah Jongg',
      body: `
<p>American Mah Jongg is a four-player game played with 152 tiles. Unlike other card and tile games, you aren't hunting for generic melds — you're trying to build <strong>one exact 14-tile pattern from a card of official hands</strong>.</p>
<div class="callout"><strong>The whole game in one sentence:</strong> be the first player to arrange 14 tiles into a hand printed on the card — then call "Mah Jongg!"</div>
<p>Here's a finished hand from this trainer's card (the "Any Like Numbers" line — a pair of flowers plus a kong of 5s in all three suits):</p>
${ROW([F, F, '|', 4, 4, 4, 4, '|', 13, 13, 13, 13, '|', 22, 22, 22, 22])}
<p>Three things make the American game unmistakable, and you'll learn all of them here:</p>
<table>
<tr><th>The card</th><td>A menu of legal hands. Only these patterns can win.</td></tr>
<tr><th>Jokers</th><td>Wild tiles that stand in for almost anything — with strict rules.</td></tr>
<tr><th>The Charleston</th><td>A tile-passing ritual before play begins. Nothing like it in any other game.</td></tr>
</table>`,
    },
    {
      title: 'Meet the tiles',
      body: `
<p>The set has 152 tiles. Here's the roster:</p>
<h4>Number suits (1–9, four copies of each)</h4>
<table>
<tr><th>Suit</th><th>Looks like</th></tr>
<tr><td>Dots</td><td>${[9, 10, 11, 12, 13, 14, 15, 16, 17].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
<tr><td>Bams</td><td>${[18, 19, 20, 21, 22, 23, 24, 25, 26].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
<tr><td>Craks</td><td>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => tileHTML(t, true)).join(' ')}</td></tr>
</table>
<h4>Winds &amp; dragons (four of each)</h4>
${ROW([27, 28, 29, 30, '|', 31, 32, 33])}
<div class="caption">East, South, West, North — then the Soap (white), Green, and Red dragons.</div>
<p>Each dragon "belongs" to a suit: <strong>Red goes with Craks, Green with Bams, and Soap with Dots</strong>. Some hands ask for the dragon that matches their suit.</p>
<h4>Flowers &amp; jokers (eight of each!)</h4>
${ROW([F, J])}
<p><strong>Flowers</strong> are a normal tile type that many hands use. <strong>Jokers</strong> are wild — the next lessons cover exactly when they can (and can't) stand in for another tile.</p>`,
    },
    {
      title: 'The card: your menu of hands',
      body: `
<p>Every year the National Mah Jongg League publishes <em>the card</em> — the official list of winning hands. Everyone plays from the same card, and a hand that isn't on it can't win, period.</p>
<div class="callout">The real NMJL card is copyrighted and changes every year (that's half the fun). This trainer uses its own <strong>practice card</strong> below — same categories, same skills, so everything you learn transfers straight to the real card.</div>
<p>Reading the notation: each block is a group you must collect. <strong>FF</strong> = pair of flowers, <strong>111</strong> = three 1s (a pung), <strong>1111</strong> = four (a kong), <strong>11111</strong> = five (a quint). Colors mean suits: groups sharing a color share a suit, different colors mean different suits. <strong>D</strong> = dragon, <strong>E S W N</strong> = winds.</p>
${cardTableHTML(false)}
<p>Points are what the hand pays when you win it — harder hands pay more. A hand marked <em>concealed</em> can't use called tiles (more on calling soon).</p>`,
    },
    {
      title: 'The Charleston',
      body: `
<p>After the deal, before anyone plays, comes the Charleston: every player passes <strong>three unwanted tiles</strong> at the same time — first to the player on their <strong>right</strong>, then <strong>across</strong>, then to the <strong>left</strong>.</p>
<p>It's a chance to trade junk for treasure, and it's where good players quietly win the game: you're not just dumping tiles, you're <em>steering your hand toward a line on the card</em>.</p>
<table>
<tr><th>Pass 1</th><td>Three tiles to the right</td></tr>
<tr><th>Pass 2</th><td>Three tiles across the table</td></tr>
<tr><th>Pass 3</th><td>Three tiles to the left</td></tr>
</table>
<div class="callout"><strong>One hard rule: you may never pass a joker.</strong> Jokers are too precious to give away anyway. (Real games can continue with an optional second Charleston and a "courtesy pass" — this trainer plays the standard first Charleston so you master the core ritual.)</div>
<div class="quiz">
  <div class="q">You were dealt a joker you don't need yet. Can you pass it in the Charleston?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="0" data-fb="Never — jokers may not be passed in the Charleston. And you WILL need it.">Yes, pass it</button>
    <button type="button" class="q-opt" data-ok="1" data-fb="Right. Jokers can never be passed — keep it and it will fill a hard group later.">No — keep it</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'Turns and calling',
      body: `
<p>After the Charleston, play begins. On your turn: <strong>draw one tile, discard one tile</strong> (name it as you throw — the trainer does this for you). Play moves counterclockwise.</p>
<p>When <em>someone else</em> discards, you may call it — but the rules are stricter than in Asian mahjong:</p>
<table>
<tr><th>Call for an exposure</th><td>Take the discard to complete a <strong>pung, kong, or quint your hand needs</strong> (jokers may fill in). The finished group goes face-up on your rack. <strong>Any</strong> player can call — there's no "runs" call, because American hands have no runs.</td></tr>
<tr><th>Call for Mah Jongg</th><td>The discard completes your entire hand — take it and win. This is the <em>only</em> way to claim a tile for a pair.</td></tr>
</table>
<div class="callout">Three traps to remember: you can <strong>never call for a pair</strong> (except the winning tile) · a <strong>discarded joker is dead</strong> — nobody may claim it · once you expose a group you're locked toward hands that contain it, and <em>concealed</em> hands are off the table.</div>
<div class="quiz">
  <div class="q">Wren discards a 6 Bam. You hold ${tileHTML(23, true)} ${tileHTML(J, true)} and your hand needs a pung of 6 Bams. Can you call it?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="1" data-fb="Yes — discard + your 6 Bam + a joker makes the pung, exposed on your rack.">Yes — expose the pung</button>
    <button type="button" class="q-opt" data-ok="0" data-fb="You can! A pung is a legal exposure, and the joker may stand in as the third tile.">No — jokers can't help</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'Jokers: the golden rules',
      body: `
<p>Eight jokers are in the set and they decide games. A joker stands in for <strong>any tile in a group of three or more</strong> — pung, kong, or quint.</p>
<table>
<tr><th>Allowed</th><td>Joker as any tile of a pung ${tileHTML(23, true)}${tileHTML(23, true)}${tileHTML(J, true)}, kong, or quint — even several jokers in one group.</td></tr>
<tr><th>Never</th><td>Jokers in a <strong>pair</strong> or as a <strong>single</strong>. ${tileHTML(13, true)}${tileHTML(J, true)} is not a pair. This is the rule that decides close games.</td></tr>
</table>
<h4>The joker exchange</h4>
<p>If a player has an exposed group containing a joker, and you hold the <em>real</em> tile the joker is standing in for, then on your turn you may <strong>swap your real tile for that joker</strong> — yes, even from an opponent's rack. Free joker!</p>
<p>And quints? Only four copies of each tile exist, so a quint is <em>literally impossible</em> without at least one joker.</p>
<div class="quiz">
  <div class="q">Your hand needs a pair of flowers to finish. You hold one flower and one joker. Are you set?</div>
  <div class="q-opts">
    <button type="button" class="q-opt" data-ok="0" data-fb="No — jokers can never complete a pair. You need the real second flower.">Yes — joker completes it</button>
    <button type="button" class="q-opt" data-ok="1" data-fb="Correct. Pairs are joker-proof — you must find the real tile. Plan pairs early!">No — pairs need real tiles</button>
  </div>
  <div class="q-fb"></div>
</div>`,
    },
    {
      title: 'Strategy 101: picking your hand',
      body: `
<p>American Mah Jongg strategy is mostly one skill: <strong>reading your 13 random tiles against the card</strong> and committing to the right line at the right time.</p>
<h4>1 · Sort your deal into categories</h4>
<p>Lots of even numbers? Look at the 2468 section. Three flowers? Hands that start FF or FFFF. Pairs everywhere? Consider the (concealed) pairs hand. Let the tiles tell you.</p>
<h4>2 · Count "tiles away"</h4>
<p>The coach shows a number for each candidate hand: how many tiles you still need. A fresh deal is usually 7–9 away; after the Charleston a good line is 5–6. Chase the smallest number, but keep a backup line alive.</p>
<h4>3 · Stay loose early, commit late</h4>
<p>During the Charleston, keep tiles that serve <em>two</em> possible hands. Once you call an exposure, you're publicly committed — so don't expose until it genuinely speeds you up.</p>
<h4>4 · Guard the endgame</h4>
<p>Late in the game, watch what a player with two exposures has revealed — you can often deduce their hand from the card and simply <em>not throw</em> what they need. Holding a useless-but-dangerous tile beats feeding a Mah Jongg.</p>
<div class="callout">Jokers are worth more than any single tile: never pass them (illegal anyway), never discard them (they become dead), and grab exchanges whenever you legally can.</div>`,
    },
    {
      title: "You're ready to play",
      body: `
<p>Time for a real game against Suki, Wren, and Nori. You're East, so you'll go first after the Charleston.</p>
<h4>What you'll see</h4>
<table>
<tr><th>Charleston first</th><td>Click 3 tiles to select them, then hit <strong>Pass</strong>. Do that three times (right, across, left). The coach will suggest what to ditch — there's a one-click "use coach's picks" button.</td></tr>
<tr><th>Your hand</th><td>Big tiles at the bottom. On your turn, click a tile to discard it. The ★ marks the coach's pick.</td></tr>
<tr><th>The card</th><td>The <strong>Card</strong> button shows every hand with a live "N away" count for your tiles. Your current best line is highlighted.</td></tr>
<tr><th>Coach panel</th><td>Every phase: what's happening, what you can do, and the best move with the why. Toggle it off to test yourself.</td></tr>
<tr><th>Gold panel</th><td>Appears when you can call a discard — exposure or Mah Jongg — with advice on whether it's worth it.</td></tr>
</table>
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

  let G = null;
  let coachOn = true;
  let cardOpen = false;
  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

  const PASS_DIRS = [
    { label: 'right', offset: 1 },
    { label: 'across', offset: 2 },
    { label: 'left', offset: 3 },
  ];

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
      exposures: [[], [], [], []],   // {tile, size, jokers}
      discards: [[], [], [], []],
      turn: 0,
      phase: 'charleston',           // then 'discard', 'calls', 'over'
      passNum: 0,
      selected: [],                  // indexes into your hand, for the Charleston
      lastDraw: null,
      lastDiscard: null,
      pending: null,
      over: false,
    };
    render();
  }

  const cnt = (p) => M.counts(G.hands[p]);

  // Tiles a seat cannot see: full set minus its hand, all discards, exposures.
  function unseenFor(p) {
    const u = new Array(M.N_TYPES);
    for (let t = 0; t < M.N_TYPES; t++) u[t] = M.copiesOf(t);
    for (const t of G.hands[p]) u[t]--;
    for (let q = 0; q < 4; q++) {
      for (const t of G.discards[q]) u[t]--;
      for (const ex of G.exposures[q]) { u[ex.tile] -= ex.size - ex.jokers; u[M.JOKER] -= ex.jokers; }
    }
    if (G.lastDiscard && G.pending) u[G.lastDiscard.tile]--;
    return u;
  }

  // ── Charleston ──

  function executePass() {
    const dir = PASS_DIRS[G.passNum];
    const passes = [];
    passes[0] = G.selected.map((i) => G.hands[0][i]);
    for (let p = 1; p < 4; p++) passes[p] = M.choosePass(cnt(p), 3);
    for (let p = 0; p < 4; p++) {
      for (const t of passes[p]) G.hands[p].splice(G.hands[p].indexOf(t), 1);
    }
    const received = [];
    for (let p = 0; p < 4; p++) {
      const to = (p + dir.offset) % 4;
      G.hands[to].push(...passes[p]);
      if (to === 0) received.push(...passes[p]);
    }
    G.hands.forEach((h) => h.sort((a, b) => a - b));
    G.selected = [];
    G.passNum++;
    if (G.passNum >= PASS_DIRS.length) {
      G.phase = 'discard';
      toast('Charleston done — you received ' + received.map(M.tileName).join(', ') + '. Your turn!');
      startTurn(0);
    } else {
      toast('You received: ' + received.map(M.tileName).join(', '));
      render();
    }
  }

  // ── Turn flow ──

  function startTurn(p) {
    if (G.over) return;
    if (G.wall.length === 0) return endWallGame();
    G.turn = p;
    const t = G.wall.pop();
    G.lastDraw = t;
    G.hands[p].push(t);
    G.hands[p].sort((a, b) => a - b);
    G.phase = 'discard';
    render();
    if (p !== 0) later(() => botTurn(p), BOT_DELAY);
  }

  function botTurn(p) {
    if (G.over) return;
    if (M.isMahjongg(cnt(p), G.exposures[p])) return endWin(p, 'self', null);
    const rows = M.evaluateDiscards(cnt(p), G.exposures[p], unseenFor(p));
    doDiscard(p, rows.length ? rows[0].tile : G.hands[p][0]);
  }

  function doDiscard(p, tile) {
    G.hands[p].splice(G.hands[p].indexOf(tile), 1);
    G.discards[p].push(tile);
    G.lastDiscard = { p, tile };
    G.lastDraw = null;
    if (tile === M.JOKER) {
      // a discarded joker is dead — no calls of any kind
      render();
      later(() => startTurn((p + 1) % 4), Math.min(BOT_DELAY, 300));
      return;
    }
    resolveCalls(p, tile);
  }

  // ── Calls on a discard ──

  function afterCallNeed(q, tile, opt) {
    // best distance if q exposes {tile, size} now (before their forced discard)
    const c = cnt(q);
    const own = Math.min(c[tile], opt.size - 1 - 0);
    const real = opt.size - 1 - opt.jokers;
    c[tile] -= real;
    c[M.JOKER] -= opt.jokers;
    const ex = G.exposures[q].concat({ tile, size: opt.size, jokers: opt.jokers });
    const need = M.bestNeed(c, ex);
    return need;
  }

  function botClaim(q, p, tile) {
    const c = cnt(q);
    c[tile]++;
    if (M.isMahjongg(c, G.exposures[q])) return { type: 'mahjongg' };
    c[tile]--;
    const before = M.bestNeed(c, G.exposures[q]);
    const opts = M.callOptions(c, G.exposures[q], tile);
    let best = null;
    for (const opt of opts) {
      const after = afterCallNeed(q, tile, opt);
      if (after < before && (!best || after < best.after)) best = { type: 'expose', opt, after };
    }
    return best;
  }

  function humanOptions(p, tile) {
    if (p === 0) return null;
    const c = cnt(0);
    c[tile]++;
    const mahjongg = M.isMahjongg(c, G.exposures[0]);
    c[tile]--;
    const exposeOpts = M.callOptions(c, G.exposures[0], tile);
    if (!mahjongg && exposeOpts.length === 0) return null;
    return { mahjongg, exposeOpts };
  }

  function resolveCalls(p, tile) {
    const claims = [];
    for (let d = 1; d < 4; d++) {
      const q = (p + d) % 4;
      if (q === 0) continue;
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
    const prio = (c) => (c.type === 'mahjongg' ? 2 : 1);
    // mahjongg beats exposure; ties go to the earliest seat after the discarder
    all.sort((a, b) => prio(b) - prio(a) || ((a.q - p + 4) % 4) - ((b.q - p + 4) % 4));
    const win = all[0];
    if (!win) {
      G.phase = 'discard';
      later(() => startTurn((p + 1) % 4), Math.min(BOT_DELAY, 300));
      return;
    }

    const q = win.q;
    if (win.type === 'mahjongg') {
      G.discards[p].pop();
      G.hands[q].push(tile);
      return endWin(q, 'discard', p);
    }

    // exposure: claimed tile + (size-1) from hand (real copies + jokers) go face-up
    G.discards[p].pop();
    G.lastDiscard = null;
    const hand = G.hands[q];
    const real = win.opt.size - 1 - win.opt.jokers;
    for (let i = 0; i < real; i++) hand.splice(hand.indexOf(tile), 1);
    for (let i = 0; i < win.opt.jokers; i++) hand.splice(hand.indexOf(M.JOKER), 1);
    G.exposures[q].push({ tile, size: win.opt.size, jokers: win.opt.jokers });
    G.turn = q;
    G.phase = 'discard';
    render();
    if (q !== 0) later(() => botTurn(q), BOT_DELAY);
  }

  // ── Human call UI ──

  const sizeWord = (s) => (s === 3 ? 'pung' : s === 4 ? 'kong' : 'quint');
  const needWord = (n) =>
    n <= 0 ? 'complete' : n + (n === 1 ? ' tile' : ' tiles') + ' away';

  function callAdvice(tile, human) {
    if (!coachOn) return '';
    if (human.mahjongg) return '<strong>Coach:</strong> that tile finishes your hand — call <strong>Mah Jongg</strong>! Always take the win.';
    const before = M.bestNeed(cnt(0), G.exposures[0]);
    let best = null;
    for (const opt of human.exposeOpts) {
      const after = afterCallNeed(0, tile, opt);
      if (!best || after < best.after) best = { opt, after };
    }
    if (best && best.after < before) {
      return '<strong>Coach:</strong> exposing the ' + sizeWord(best.opt.size) + ' takes you from ' + needWord(before) +
        ' to ' + needWord(best.after) + ' — worth it. Remember: exposures are public and lock out concealed hands.';
    }
    return '<strong>Coach:</strong> skip. Calling wouldn’t bring your best line closer (you’re ' + needWord(before) +
      ' either way), and exposing tells the table what you’re building.';
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
    };
    if (human.mahjongg) mk('MAH JONGG!', 'win-call', () => finishCalls(p, tile, G.pending.claims, { type: 'mahjongg' }));
    human.exposeOpts.forEach((opt) => {
      const label = 'Expose ' + sizeWord(opt.size) + (opt.jokers ? ' (+' + opt.jokers + ' joker' + (opt.jokers > 1 ? 's' : '') + ')' : '');
      mk(label, 'shout', () => finishCalls(p, tile, G.pending.claims, { type: 'expose', opt }));
    });
    mk('Skip', '', () => finishCalls(p, tile, G.pending.claims, null));
    bar.hidden = false;
  }

  // ── Joker exchange ──

  function exchangeOptions() {
    // real tiles in your hand matching a joker on any exposed rack
    const c = cnt(0);
    const out = [];
    const seen = new Set();
    for (let q = 0; q < 4; q++) {
      for (const ex of G.exposures[q]) {
        if (ex.jokers > 0 && c[ex.tile] > 0 && !seen.has(q + ':' + ex.tile)) {
          seen.add(q + ':' + ex.tile);
          out.push({ q, ex });
        }
      }
    }
    return out;
  }

  function doExchange(q, ex) {
    G.hands[0].splice(G.hands[0].indexOf(ex.tile), 1);
    G.hands[0].push(M.JOKER);
    G.hands[0].sort((a, b) => a - b);
    ex.jokers--;
    toast('Swapped your ' + M.tileName(ex.tile) + ' for a joker from ' + (q === 0 ? 'your own' : SEATS[q].name + '’s') + ' rack!');
    render();
  }

  // ── Endings ──

  function winningHandInfo(q) {
    const rows = M.bestHands(cnt(q), G.exposures[q], 1);
    return rows.length && rows[0].need === 0 ? M.CARD[rows[0].hand] : null;
  }

  function endWin(q, method, fromSeat) {
    G.over = true;
    G.phase = 'over';
    clearTimers();
    $('call-bar').hidden = true;
    const you = q === 0;
    const hand = winningHandInfo(q);
    const title = you ? '🎉 Mah Jongg — you win!' : SEATS[q].name + ' calls Mah Jongg';
    const how = method === 'self'
      ? (you ? 'You drew your own winning tile.' : SEATS[q].name + ' drew the winning tile.')
      : (you ? 'You claimed the winning tile from ' + SEATS[fromSeat].name + '.'
             : SEATS[q].name + ' claimed ' + (fromSeat === 0 ? 'your' : SEATS[fromSeat].name + '’s') + ' discard.');
    let body = '<p>' + how + '</p>';
    if (hand) {
      body += '<p><strong>' + hand.cat + '</strong> — <span class="card-notation">' + notationHTML(hand) + '</span> · <strong>' + hand.points + ' points</strong></p>';
    }
    body += '<div class="tile-row">' + G.hands[q].map((t) => tileHTML(t, true)).join('') +
      G.exposures[q].map((ex) => ' &nbsp;' + exposureTiles(ex).map((t) => tileHTML(t, true)).join('')).join('') + '</div>';
    if (!you && coachOn) body += '<p>Find that pattern on the card — matching revealed hands back to the card is how you learn to read the table.</p>';
    showDialog(title, body);
    render();
  }

  function endWallGame() {
    G.over = true;
    G.phase = 'over';
    clearTimers();
    $('call-bar').hidden = true;
    showDialog('Wall game — nobody wins',
      '<p>The wall ran out before anyone completed a hand. It happens! Next time, commit to a card line earlier — the Charleston is where hands are made.</p>');
    render();
  }

  function showDialog(title, bodyHTML) {
    $('mj-dialog-title').innerHTML = title;
    $('mj-dialog-body').innerHTML = bodyHTML;
    $('mj-dialog').hidden = false;
  }
  $('mj-dialog-btn').addEventListener('click', () => { $('mj-dialog').hidden = true; newGame(); });

  // ── Coach ──

  function lineName(handIdx) {
    return '<strong>' + M.CARD[handIdx].cat + '</strong> (<span class="card-notation">' + notationHTML(M.CARD[handIdx]) + '</span>)';
  }

  function coachHTML() {
    if (!G) return '';
    if (G.over) return '<div class="co-phase">Game over.</div><div>Hit <strong>New game</strong> to deal again — reading fresh deals against the card is the core skill.</div>';

    if (G.phase === 'charleston') {
      const dir = PASS_DIRS[G.passNum];
      let html = '<div class="co-phase">Charleston — pass ' + (G.passNum + 1) + ' of 3: choose 3 tiles to pass to the <strong>' + dir.label + '</strong>.</div>';
      if (!coachOn) return html + '<div>Click 3 tiles, then hit Pass. (Coach is off — you’re flying solo.)</div>';
      const tops = M.bestHands(cnt(0), [], 2);
      const picks = M.choosePass(cnt(0), 3);
      html += '<div class="co-reco">Your strongest lines: ' + tops.map((r) => lineName(r.hand) + ' — ' + needWord(r.need)).join(' · ') + '.</div>';
      html += '<div class="co-why">Coach would pass: ' + picks.map((t) => tileHTML(t, true)).join('') +
        ' — they don’t serve those lines. Jokers can never be passed.</div>';
      return html;
    }

    if (G.pending) {
      return '<div class="co-phase">Decision: someone discarded a tile you can use.</div>' +
        '<div>Check the gold panel — it lists every call you’re allowed to make right now' + (coachOn ? ', with my advice' : '') + '.</div>';
    }

    if (G.turn !== 0) {
      return '<div class="co-phase">' + SEATS[G.turn].name + ' (' + SEATS[G.turn].wind + ') is taking their turn…</div>' +
        '<div>Watch the discards and racks — exposed groups narrow down exactly which card hand a player is building.</div>';
    }

    // your discard phase
    const c = cnt(0);
    const drewLine = G.lastDraw !== null
      ? 'You drew ' + tileHTML(G.lastDraw, true) + ' ' + NAME(G.lastDraw) + '.'
      : 'You called a tile — no draw, just discard one.';

    if (M.isMahjongg(c, G.exposures[0])) {
      return '<div class="co-phase">' + drewLine + '</div>' +
        '<div class="co-win">Your hand matches the card — press MAH JONGG to declare the win!</div>';
    }

    if (!coachOn) {
      return '<div class="co-phase">' + drewLine + '</div><div>Your turn — click a tile to discard it. (Coach is off — you’re flying solo.)</div>';
    }

    const rows = M.evaluateDiscards(c, G.exposures[0], unseenFor(0));
    if (!rows.length) return '<div class="co-phase">' + drewLine + '</div>';
    const reco = rows[0];
    let html = '<div class="co-phase">' + drewLine + ' Now discard one tile — click it.</div>';
    if (reco.target !== null) {
      html += '<div class="co-reco">Best line: ' + lineName(reco.target) + ' — you’d be <strong>' + needWord(reco.need) + '</strong>.</div>';
    }
    html += '<div class="co-reco">Best discard: <strong>' + M.tileName(reco.tile) + '</strong> ' + tileHTML(reco.tile, true) + '</div>';
    html += '<div class="co-why">Why: ' + discardReason(reco, c) + '</div>';
    if (reco.improving.length) {
      const shown = reco.improving.slice(0, 9);
      html += '<div class="co-tiles"><span class="lead">' + reco.ukeire + ' live tiles improve you:</span>' +
        shown.map((x) => tileHTML(x.tile, true)).join('') + (reco.improving.length > shown.length ? ' …' : '') + '</div>';
    }
    const ex = exchangeOptions();
    if (ex.length) {
      html += '<div class="co-why">💡 You hold a real ' + M.tileName(ex[0].ex.tile) + ' matching an exposed joker — the <strong>swap button</strong> below trades it for the joker. Free wild tile: take it.</div>';
    }
    return html;
  }

  function discardReason(reco, c) {
    const t = reco.tile;
    const useful = M.usefulCounts(c, G.exposures[0], 3);
    if (c[t] > useful[t]) {
      return 'None of your top card lines use it' + (c[t] > 1 && useful[t] > 0 ? ' (beyond the copies you keep)' : '') +
        ', so it’s pure surplus — every other discard would cost you progress.';
    }
    return 'Your tiles overlap several lines, so shed from the weakest one: this keeps you ' + needWord(reco.need) +
      ' with ' + reco.ukeire + ' live tiles to draw.';
  }

  // ── Rendering ──

  function exposureTiles(ex) {
    const real = ex.size - ex.jokers;
    const out = [];
    for (let i = 0; i < real; i++) out.push(ex.tile);
    for (let i = 0; i < ex.jokers; i++) out.push(M.JOKER);
    return out;
  }

  function render() {
    if (!G) return;
    $('wall-count').textContent = G.phase === 'charleston'
      ? 'Charleston · pass ' + (G.passNum + 1) + '/3'
      : 'Wall: ' + G.wall.length + ' tiles';

    // opponents
    const opps = $('opponents');
    opps.innerHTML = '';
    for (let p = 1; p < 4; p++) {
      const row = document.createElement('div');
      row.className = 'opp' + (G.turn === p && !G.over && G.phase !== 'charleston' ? ' active' : '');
      row.id = 'opp-' + p;
      const head = document.createElement('div');
      head.className = 'opp-head';
      const name = document.createElement('span');
      name.className = 'opp-name';
      name.textContent = (G.turn === p && !G.over && G.phase !== 'charleston' ? '▸ ' : '') + SEATS[p].name + ' · ' + SEATS[p].wind;
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
      for (const ex of G.exposures[p]) {
        const gEl = document.createElement('span');
        gEl.className = 'meld';
        exposureTiles(ex).forEach((t) => gEl.appendChild(tileSpan(t, true)));
        melds.appendChild(gEl);
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
    $('your-river-row').classList.toggle('active', G.turn === 0 && !G.over && G.phase !== 'charleston');
    const r0 = $('river-0');
    r0.innerHTML = '';
    G.discards[0].forEach((t, i) => {
      const el = tileSpan(t, true);
      if (G.lastDiscard && G.lastDiscard.p === 0 && i === G.discards[0].length - 1) el.classList.add('just-discarded');
      r0.appendChild(el);
    });

    // your exposures
    const pm = $('player-melds');
    pm.innerHTML = '';
    for (const ex of G.exposures[0]) {
      const gEl = document.createElement('span');
      gEl.className = 'meld';
      exposureTiles(ex).forEach((t) => gEl.appendChild(tileSpan(t, true)));
      pm.appendChild(gEl);
    }

    // your hand
    const handEl = $('hand');
    handEl.innerHTML = '';
    const charleston = G.phase === 'charleston' && !G.over;
    const yourTurn = G.turn === 0 && G.phase === 'discard' && !G.over && !G.pending;
    let recoTile = null;
    if (yourTurn && coachOn && !M.isMahjongg(cnt(0), G.exposures[0])) {
      const rows = M.evaluateDiscards(cnt(0), G.exposures[0], unseenFor(0));
      if (rows.length) recoTile = rows[0].tile;
    }
    let recoMarked = false;
    G.hands[0].forEach((t, i) => {
      const b = tileButton(t);
      if (charleston) {
        b.disabled = t === M.JOKER; // jokers can never be passed
        if (G.selected.includes(i)) b.classList.add('sel');
        b.addEventListener('click', () => toggleSelect(i));
      } else {
        b.disabled = !yourTurn;
        if (t === recoTile && !recoMarked) { b.classList.add('reco'); recoMarked = true; }
        b.addEventListener('click', () => onHandClick(t));
      }
      handEl.appendChild(b);
    });

    // action buttons
    const actions = $('hand-actions');
    actions.innerHTML = '';
    const mkBtn = (label, cls, fn, id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pixel-btn' + (cls ? ' ' + cls : '');
      if (id) b.id = id;
      b.innerHTML = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
      return b;
    };
    if (charleston) {
      const dir = PASS_DIRS[G.passNum];
      const passBtn = mkBtn('Pass 3 ' + dir.label + ' ▸', 'shout', () => { if (G.selected.length === 3) executePass(); }, 'pass-btn');
      passBtn.disabled = G.selected.length !== 3;
      mkBtn('Use coach’s picks', '', () => {
        const picks = M.choosePass(cnt(0), 3);
        G.selected = [];
        for (const t of picks) {
          for (let i = 0; i < G.hands[0].length; i++) {
            if (G.hands[0][i] === t && !G.selected.includes(i)) { G.selected.push(i); break; }
          }
        }
        render();
      }, 'pass-suggest');
    } else if (yourTurn) {
      if (M.isMahjongg(cnt(0), G.exposures[0])) {
        mkBtn('MAH JONGG — declare the win!', 'win-call', () => endWin(0, 'self', null), 'mahjongg-btn');
      }
      exchangeOptions().forEach(({ q, ex }) => {
        mkBtn('Swap ' + tileHTML(ex.tile, true) + ' for ' + tileHTML(M.JOKER, true), '', () => doExchange(q, ex));
      });
    }

    // coach + card panel
    $('coach').classList.toggle('coach-off', !coachOn);
    $('coach-body').innerHTML = coachHTML();
    renderCardPanel();
  }

  function renderCardPanel() {
    const panel = $('card-panel');
    panel.hidden = !cardOpen;
    $('card-btn').classList.toggle('active', cardOpen);
    if (!cardOpen || !G) return;
    const rows = M.bestHands(cnt(0), G.exposures[0]);
    const needs = new Map();
    rows.forEach((r, i) => needs.set(r.hand, { need: r.need, rank: i }));
    panel.innerHTML = '<div class="card-head pixel">PRACTICE CARD — live "tiles away" for your hand</div>' + cardTableHTML(true, needs);
  }

  function toggleSelect(i) {
    if (G.phase !== 'charleston') return;
    const at = G.selected.indexOf(i);
    if (at !== -1) G.selected.splice(at, 1);
    else if (G.selected.length < 3) G.selected.push(i);
    render();
  }

  function onHandClick(t) {
    if (!G || G.over || G.pending || G.turn !== 0 || G.phase !== 'discard') return;
    if (t === M.JOKER) {
      toast('Keep your joker! Discarded jokers are dead — nobody can ever use them again.');
      return;
    }
    if (coachOn && !M.isMahjongg(cnt(0), G.exposures[0])) {
      const rows = M.evaluateDiscards(cnt(0), G.exposures[0], unseenFor(0));
      const reco = rows[0];
      const chosen = rows.find((r) => r.tile === t);
      if (chosen && reco && chosen.tile !== reco.tile) {
        if (chosen.need > reco.need) {
          toast('That set you back — ' + M.tileName(reco.tile) + ' kept you ' + needWord(reco.need) + ' on your best line.');
        } else if (reco.ukeire > chosen.ukeire) {
          toast('Playable — but ' + M.tileName(reco.tile) + ' kept ' + reco.ukeire + ' live tiles vs your ' + chosen.ukeire + '.');
        } else {
          toast('Just as good as the coach’s pick. Nice.');
        }
      }
    }
    doDiscard(0, t);
  }

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  $('new-game').addEventListener('click', newGame);
  $('coach-toggle').addEventListener('change', (e) => { coachOn = e.target.checked; render(); });
  $('card-btn').addEventListener('click', () => { cardOpen = !cardOpen; renderCardPanel(); });

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
        passNum: G.passNum,
        over: G.over,
        pending: !!G.pending,
        wall: G.wall.length,
        handSizes: G.hands.map((h) => h.length),
        discardCounts: G.discards.map((d) => d.length),
        exposures: G.exposures.map((e) => e.length),
      };
    },
    newGame,
  };
})();
