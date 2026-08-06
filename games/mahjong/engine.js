/*
 * Mahjong engine — pure game logic, no DOM.
 * Exposed as window.Mahjong so the UI (game.js) and Playwright tests share it.
 *
 * Tile encoding: a tile is an integer 0–33.
 *   0–8   characters (wan)  1–9   "m"
 *   9–17  dots (circles)    1–9   "p"
 *   18–26 bamboo (sticks)   1–9   "s"
 *   27–33 honors: East, South, West, North, White, Green, Red
 * The wall holds four copies of each: 136 tiles.
 */
(function (global) {
  'use strict';

  const HONOR_NAMES = ['East', 'South', 'West', 'North', 'White Dragon', 'Green Dragon', 'Red Dragon'];
  const SUIT_NAMES = { m: 'Characters', p: 'Dots', s: 'Bamboo' };

  const suitOf = (t) => (t < 9 ? 'm' : t < 18 ? 'p' : t < 27 ? 's' : 'z');
  const numOf = (t) => (t < 27 ? (t % 9) + 1 : t - 26);
  const isHonor = (t) => t >= 27;
  const isTerminal = (t) => !isHonor(t) && (numOf(t) === 1 || numOf(t) === 9);

  function tileName(t) {
    if (isHonor(t)) return HONOR_NAMES[t - 27];
    return numOf(t) + ' ' + SUIT_NAMES[suitOf(t)];
  }

  // Deterministic PRNG (mulberry32) so games can be replayed via ?seed=
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWall(rand) {
    const wall = [];
    for (let t = 0; t < 34; t++) for (let i = 0; i < 4; i++) wall.push(t);
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    return wall;
  }

  function counts(tiles) {
    const c = new Array(34).fill(0);
    for (const t of tiles) c[t]++;
    return c;
  }

  /*
   * Standard-hand shanten: how many tile swaps away from a complete hand
   * (four sets + a pair). -1 means the hand is complete, 0 means ready
   * (tenpai). openMeldCount is the number of melds already claimed —
   * they count as finished sets.
   *
   * The hand is split into its four independent groups (three suits +
   * honors). Each group's achievable {sets, partials, pair} decompositions
   * are enumerated once and memoized globally — the coach and bots evaluate
   * hundreds of near-identical hands per turn, so the cache hit rate is high.
   */
  const GROUP_CACHE = new Map();

  function groupOptions(cells, allowRuns) {
    const key = (allowRuns ? 'r' : 'h') + cells.join('');
    const hit = GROUP_CACHE.get(key);
    if (hit) return hit;
    const c = cells.slice();
    const seen = new Set();
    const found = [];

    function emit(s, p, pair) {
      const k = s * 100 + p * 10 + (pair ? 1 : 0);
      if (!seen.has(k)) { seen.add(k); found.push([s, p, pair ? 1 : 0]); }
    }

    function walk(i, s, p, pair) {
      while (i < c.length && c[i] === 0) i++;
      if (i >= c.length) { emit(s, p, pair); return; }
      if (c[i] >= 3) { c[i] -= 3; walk(i, s + 1, p, pair); c[i] += 3; }
      if (allowRuns && i + 2 < c.length && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        walk(i, s + 1, p, pair);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (c[i] >= 2) {
        if (!pair) { c[i] -= 2; walk(i, s, p, true); c[i] += 2; }
        c[i] -= 2; walk(i, s, p + 1, pair); c[i] += 2;
      }
      if (allowRuns && i + 1 < c.length && c[i + 1] > 0) {
        c[i]--; c[i + 1]--;
        walk(i, s, p + 1, pair);
        c[i]++; c[i + 1]++;
      }
      if (allowRuns && i + 2 < c.length && c[i + 2] > 0) {
        c[i]--; c[i + 2]--;
        walk(i, s, p + 1, pair);
        c[i]++; c[i + 2]++;
      }
      // leave one copy aside as a floater
      c[i]--;
      walk(c[i] > 0 ? i : i + 1, s, p, pair);
      c[i]++;
    }

    walk(0, 0, 0, false);
    // Pareto-prune: more sets/partials/pair is never worse, so drop dominated rows
    const options = found.filter(([s, p, pr]) =>
      !found.some(([s2, p2, pr2]) =>
        (s2 !== s || p2 !== p || pr2 !== pr) && s2 >= s && p2 >= p && pr2 >= pr));
    GROUP_CACHE.set(key, options);
    return options;
  }

  function shanten(tileList, openMeldCount) {
    const open = openMeldCount || 0;
    const c = counts(tileList);
    const groups = [
      groupOptions(c.slice(0, 9), true),
      groupOptions(c.slice(9, 18), true),
      groupOptions(c.slice(18, 27), true),
      groupOptions(c.slice(27, 34), false),
    ];
    const maxBlocks = 4 - open;
    let best = 8;
    for (const a of groups[0]) for (const b of groups[1]) for (const g of groups[2]) for (const d of groups[3]) {
      const pair = a[2] + b[2] + g[2] + d[2];
      if (pair > 1) continue;
      const s = Math.min(a[0] + b[0] + g[0] + d[0], maxBlocks);
      const p = Math.min(a[1] + b[1] + g[1] + d[1], maxBlocks - s);
      const sh = 8 - 2 * (s + open) - p - (pair ? 1 : 0);
      if (sh < best) best = sh;
    }
    return best;
  }

  const isWinningHand = (tiles, openMeldCount) => shanten(tiles, openMeldCount) === -1;

  /*
   * Ukeire: with a 13-mod-3 hand, which tile types would move it closer to
   * winning, and how many copies of them are still unseen?
   * unseen: optional 34-array of remaining copies; defaults to 4 minus hand.
   */
  function ukeire(tiles, openMeldCount, unseen) {
    const base = shanten(tiles, openMeldCount);
    const own = counts(tiles);
    const out = [];
    let total = 0;
    for (let t = 0; t < 34; t++) {
      const avail = unseen ? unseen[t] : 4 - own[t];
      if (avail <= 0) continue;
      if (shanten(tiles.concat(t), openMeldCount) < base) {
        out.push({ tile: t, count: avail });
        total += avail;
      }
    }
    return { shanten: base, total, tiles: out };
  }

  /*
   * Rank every distinct discard from a 14-mod-3 hand: lowest resulting
   * shanten first, most improving tiles (ukeire) as the tiebreak.
   */
  function evaluateDiscards(tiles, openMeldCount, unseen) {
    const seen = new Set();
    const rows = [];
    tiles.forEach((t, idx) => {
      if (seen.has(t)) return;
      seen.add(t);
      const rest = tiles.slice();
      rest.splice(idx, 1);
      const u = ukeire(rest, openMeldCount, unseen);
      rows.push({ tile: t, shanten: u.shanten, ukeire: u.total, tiles: u.tiles });
    });
    rows.sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire);
    return rows;
  }

  // Which pairs of hand tiles could form a run with a claimed discard?
  function chowOptions(handTiles, t) {
    if (isHonor(t)) return [];
    const own = counts(handTiles);
    const s = Math.floor(t / 9) * 9;
    const opts = [];
    const has = (x) => x >= s && x < s + 9 && own[x] > 0;
    if (has(t - 2) && has(t - 1)) opts.push([t - 2, t - 1]);
    if (has(t - 1) && has(t + 1)) opts.push([t - 1, t + 1]);
    if (has(t + 1) && has(t + 2)) opts.push([t + 1, t + 2]);
    return opts;
  }

  /*
   * Light-touch pattern spotting for the win screen — a friendly nod toward
   * scoring without teaching a full scoring table.
   */
  function winPatterns(allTiles, method, seatWind) {
    const c = counts(allTiles);
    const suits = new Set(allTiles.filter((t) => !isHonor(t)).map(suitOf));
    const honors = allTiles.some(isHonor);
    const out = [];
    if (suits.size === 1 && !honors) out.push('Full Flush — every tile from one suit');
    else if (suits.size === 1 && honors) out.push('Half Flush — one suit plus honors');
    if (allTiles.every((t) => !isHonor(t) && !isTerminal(t))) out.push('All Simples — no 1s, 9s, or honors');
    for (let d = 31; d <= 33; d++) if (c[d] >= 3) out.push('Dragon triplet — ' + HONOR_NAMES[d - 27]);
    if (seatWind !== undefined && c[27 + seatWind] >= 3) out.push('Seat wind triplet — ' + HONOR_NAMES[seatWind]);
    if (method === 'tsumo') out.push('Self-draw win (tsumo)');
    return out;
  }

  global.Mahjong = {
    suitOf, numOf, isHonor, isTerminal, tileName,
    rng, buildWall, counts,
    shanten, isWinningHand, ukeire, evaluateDiscards, chowOptions, winPatterns,
  };
})(typeof window !== 'undefined' ? window : globalThis);
