/*
 * American Mah Jongg engine — pure game logic, no DOM.
 * Exposed as window.Mahjong so the UI (game.js) and Playwright tests share it.
 *
 * Tile encoding: a tile is an integer 0–35.
 *   0–8   craks (characters) 1–9   "m"
 *   9–17  dots (circles)     1–9   "p"
 *   18–26 bams (bamboo)      1–9   "s"
 *   27–30 winds: East, South, West, North
 *   31    soap (white dragon — also the zero tile)
 *   32    green dragon   33  red dragon
 *   34    flower         35  joker
 * Copies: 4 of everything except flowers (8) and jokers (8) → 152 tiles.
 *
 * American hands are fixed patterns from a card. This engine ships an
 * ORIGINAL practice card (not the copyrighted NMJL card) covering the
 * classic categories. Every hand is a list of groups; jokers may stand in
 * for any tile in a group of three or more, never in pairs or singles.
 */
(function (global) {
  'use strict';

  const CRAK = 0, DOT = 9, BAM = 18;
  const EAST = 27, SOUTH = 28, WEST = 29, NORTH = 30;
  const SOAP = 31, GREEN = 32, RED = 33, FLOWER = 34, JOKER = 35;
  const N_TYPES = 36;

  const HONOR_NAMES = ['East', 'South', 'West', 'North', 'Soap (White Dragon)', 'Green Dragon', 'Red Dragon', 'Flower', 'Joker'];
  const SUIT_NAMES = { m: 'Craks', p: 'Dots', s: 'Bams' };
  // "matching" dragon for each suit base: craks↔red, dots↔soap, bams↔green
  const MATCH_DRAGON = { 0: RED, 9: SOAP, 18: GREEN };

  const suitOf = (t) => (t < 9 ? 'm' : t < 18 ? 'p' : t < 27 ? 's' : 'z');
  const numOf = (t) => (t < 27 ? (t % 9) + 1 : 0);
  const isJoker = (t) => t === JOKER;
  const isFlower = (t) => t === FLOWER;

  function copiesOf(t) { return t >= FLOWER ? 8 : 4; }

  function tileName(t) {
    if (t >= EAST) return HONOR_NAMES[t - EAST];
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
    for (let t = 0; t < N_TYPES; t++) for (let i = 0; i < copiesOf(t); i++) wall.push(t);
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    return wall;
  }

  function counts(tiles) {
    const c = new Array(N_TYPES).fill(0);
    for (const t of tiles) c[t]++;
    return c;
  }

  // ═══ The practice card ═══
  // Groups are {tile, size}; jokers are legal in any group with size >= 3.

  const SUITS = [CRAK, DOT, BAM];
  const DRAGONS = [SOAP, GREEN, RED];
  const g = (tile, size) => ({ tile, size });

  function permutations2() {
    const out = [];
    for (const a of SUITS) for (const b of SUITS) if (a !== b) out.push([a, b]);
    return out;
  }
  function permutations3() {
    const out = [];
    for (const a of SUITS) for (const b of SUITS) for (const c of SUITS)
      if (a !== b && a !== c && b !== c) out.push([a, b, c]);
    return out;
  }

  const CARD = [
    {
      id: 'like-numbers', cat: 'Any Like Numbers', points: 30,
      notation: 'FF 1111 1111 1111', note: 'Any number 1–9; a kong of it in every suit.',
      variants() {
        const v = [];
        for (let n = 0; n < 9; n++)
          v.push([g(FLOWER, 2), g(CRAK + n, 4), g(DOT + n, 4), g(BAM + n, 4)]);
        return v;
      },
    },
    {
      id: 'evens-run', cat: '2468', points: 25,
      notation: '222 444 6666 8888', note: '2s and 4s in one suit, 6s and 8s in a second suit.',
      variants() {
        const v = [];
        for (const [a, b] of permutations2())
          v.push([g(a + 1, 3), g(a + 3, 3), g(b + 5, 4), g(b + 7, 4)]);
        return v;
      },
    },
    {
      id: 'evens-dragons', cat: '2468', points: 30,
      notation: '22 44 666 888 DDDD', note: 'One suit with a kong of its matching dragon (craks·red, bams·green, dots·soap).',
      variants() {
        return SUITS.map((a) => [g(a + 1, 2), g(a + 3, 2), g(a + 5, 3), g(a + 7, 3), g(MATCH_DRAGON[a], 4)]);
      },
    },
    {
      id: 'consec-kongs', cat: 'Consecutive Run', points: 25,
      notation: '111 2222 333 4444', note: 'Four consecutive numbers in one suit, starting anywhere 1–6.',
      variants() {
        const v = [];
        for (const a of SUITS) for (let n = 0; n <= 5; n++)
          v.push([g(a + n, 3), g(a + n + 1, 4), g(a + n + 2, 3), g(a + n + 3, 4)]);
        return v;
      },
    },
    {
      id: 'consec-climb', cat: 'Consecutive Run', points: 30,
      notation: '11 22 333 444 5555', note: 'Five consecutive numbers in one suit, starting anywhere 1–5.',
      variants() {
        const v = [];
        for (const a of SUITS) for (let n = 0; n <= 4; n++)
          v.push([g(a + n, 2), g(a + n + 1, 2), g(a + n + 2, 3), g(a + n + 3, 3), g(a + n + 4, 4)]);
        return v;
      },
    },
    {
      id: 'odds-135', cat: '13579', points: 25,
      notation: '11 333 5555 777 99', note: 'All five odd numbers in one suit.',
      variants() {
        return SUITS.map((a) => [g(a + 0, 2), g(a + 2, 3), g(a + 4, 4), g(a + 6, 3), g(a + 8, 2)]);
      },
    },
    {
      id: 'odds-heavy-nine', cat: '13579', points: 30,
      notation: '111 33 555 77 9999', note: 'All five odd numbers in one suit, kong of 9s.',
      variants() {
        return SUITS.map((a) => [g(a + 0, 3), g(a + 2, 2), g(a + 4, 3), g(a + 6, 2), g(a + 8, 4)]);
      },
    },
    {
      id: 'winds-dragons', cat: 'Winds & Dragons', points: 30,
      notation: 'EEE SSS WWW NNN DD', note: 'Pungs of all four winds, pair of any dragon.',
      variants() {
        return DRAGONS.map((d) => [g(EAST, 3), g(SOUTH, 3), g(WEST, 3), g(NORTH, 3), g(d, 2)]);
      },
    },
    {
      id: 'three-six-nine', cat: '369', points: 30,
      notation: '3333 6666 9999 DD', note: 'Kongs of 3, 6, 9 in three different suits, pair of any dragon.',
      variants() {
        const v = [];
        for (const [a, b, c] of permutations3()) for (const d of DRAGONS)
          v.push([g(a + 2, 4), g(b + 5, 4), g(c + 8, 4), g(d, 2)]);
        return v;
      },
    },
    {
      id: 'quints', cat: 'Quints', points: 40,
      notation: 'FFFF 11111 11111', note: 'Quints of the same number in two suits — impossible without jokers.',
      variants() {
        const v = [];
        for (let n = 0; n < 9; n++) for (const [a, b] of permutations2())
          v.push([g(FLOWER, 4), g(a + n, 5), g(b + n, 5)]);
        return v;
      },
    },
    {
      id: 'seven-pairs', cat: 'Singles & Pairs', points: 50, concealed: true,
      notation: '11 22 33 44 55 66 77', note: 'Seven consecutive pairs in one suit, starting 1–3. Concealed — no exposures, and pairs never take jokers.',
      variants() {
        const v = [];
        for (const a of SUITS) for (let n = 0; n <= 2; n++)
          v.push([g(a + n, 2), g(a + n + 1, 2), g(a + n + 2, 2), g(a + n + 3, 2), g(a + n + 4, 2), g(a + n + 5, 2), g(a + n + 6, 2)]);
        return v;
      },
    },
  ];

  // Pre-expand every hand into concrete variants once.
  const ALL_VARIANTS = [];
  CARD.forEach((hand, hi) => {
    for (const groups of hand.variants()) {
      ALL_VARIANTS.push({ hand: hi, groups });
    }
  });

  /*
   * Distance of a hand (counts + exposures) from one concrete variant:
   * the number of tiles still needed to complete it. Infinity when the
   * variant is incompatible with the exposures already on the table.
   * Jokers in hand fill shortfalls in groups of 3+, never pairs/singles.
   */
  function variantNeed(c, exposures, variant) {
    const hand = CARD[variant.hand];
    if (exposures.length && hand.concealed) return Infinity;
    // each exposure must claim a distinct matching group
    const taken = new Array(variant.groups.length).fill(false);
    for (const ex of exposures) {
      let ok = false;
      for (let i = 0; i < variant.groups.length; i++) {
        const grp = variant.groups[i];
        if (!taken[i] && grp.tile === ex.tile && grp.size === ex.size) { taken[i] = true; ok = true; break; }
      }
      if (!ok) return Infinity;
    }
    let shortSmall = 0, shortBig = 0;
    const used = new Array(N_TYPES).fill(0);
    for (let i = 0; i < variant.groups.length; i++) {
      if (taken[i]) continue;
      const grp = variant.groups[i];
      const have = Math.min(c[grp.tile] - used[grp.tile], grp.size);
      used[grp.tile] += Math.max(0, have);
      const short = grp.size - Math.max(0, have);
      if (grp.size >= 3) shortBig += short; else shortSmall += short;
    }
    return shortSmall + Math.max(0, shortBig - c[JOKER]);
  }

  /*
   * Rank the card against a hand: for every card hand, the minimum tiles
   * needed across its variants. Sorted best-first.
   */
  function bestHands(c, exposures, topN) {
    const best = new Array(CARD.length).fill(null);
    for (const v of ALL_VARIANTS) {
      const need = variantNeed(c, exposures, v);
      if (need === Infinity) continue;
      if (!best[v.hand] || need < best[v.hand].need) best[v.hand] = { hand: v.hand, need, variant: v };
    }
    const rows = best.filter(Boolean);
    rows.sort((a, b) => a.need - b.need || CARD[b.hand].points - CARD[a.hand].points);
    return topN ? rows.slice(0, topN) : rows;
  }

  const bestNeed = (c, exposures) => {
    const rows = bestHands(c, exposures, 1);
    return rows.length ? rows[0].need : Infinity;
  };

  // A hand wins when 14 tiles (counting exposures) complete a pattern exactly.
  function isMahjongg(c, exposures) {
    let total = c.reduce((a, b) => a + b, 0);
    for (const ex of exposures) total += ex.size;
    return total === 14 && bestNeed(c, exposures) === 0;
  }

  /*
   * Which tiles of the (concealed) hand does the best variant actually use?
   * Everything else is surplus — Charleston and discard fodder.
   * Considers the top few hands so a close second line isn't stripped.
   */
  function usefulCounts(c, exposures, depth) {
    const rows = bestHands(c, exposures, depth || 3);
    const useful = new Array(N_TYPES).fill(0);
    for (const row of rows) {
      const inVariant = new Array(N_TYPES).fill(0);
      for (const grp of row.variant.groups) inVariant[grp.tile] += grp.size;
      for (let t = 0; t < N_TYPES; t++) {
        useful[t] = Math.max(useful[t], Math.min(c[t], inVariant[t]));
      }
    }
    useful[JOKER] = c[JOKER]; // jokers are always worth keeping
    return useful;
  }

  /*
   * Rank every distinct discard from a hand holding one extra tile:
   * lowest remaining distance first, then the most live improving tiles.
   * unseen: 36-array of copies not visible to the player. Jokers are never
   * offered as discards unless literally nothing else is legal.
   */
  function evaluateDiscards(c, exposures, unseen) {
    const rows = [];
    for (let t = 0; t < N_TYPES; t++) {
      if (c[t] === 0 || t === JOKER) continue;
      c[t]--;
      const ranked = bestHands(c, exposures, 2);
      const need = ranked.length ? ranked[0].need : Infinity;
      let ukeire = 0;
      const improving = [];
      for (let u = 0; u < N_TYPES; u++) {
        const avail = unseen ? unseen[u] : copiesOf(u) - c[u];
        if (avail <= 0) continue;
        c[u]++;
        if (bestNeed(c, exposures) < need) { ukeire += avail; improving.push({ tile: u, count: avail }); }
        c[u]--;
      }
      rows.push({ tile: t, need, ukeire, improving, target: ranked.length ? ranked[0].hand : null });
      c[t]++;
    }
    rows.sort((a, b) => a.need - b.need || b.ukeire - a.ukeire);
    return rows;
  }

  /*
   * Charleston: choose n tiles to pass. Jokers may never be passed.
   * Strategy: keep everything the top card lines use; pass the rest,
   * least-connected first.
   */
  function choosePass(c, n) {
    const useful = usefulCounts(c, [], 3);
    const pass = [];
    const surplus = [];
    for (let t = 0; t < N_TYPES; t++) {
      if (t === JOKER) continue;
      for (let k = useful[t]; k < c[t]; k++) surplus.push(t);
    }
    // pass honors and flowers among the surplus last (flowers feed many hands)
    surplus.sort((a, b) => (a === FLOWER ? 1 : 0) - (b === FLOWER ? 1 : 0));
    while (pass.length < n && surplus.length) pass.push(surplus.shift());
    if (pass.length < n) {
      // hand is dense: shed the copies whose loss hurts the least
      const work = c.slice();
      for (const t of pass) work[t]--;
      while (pass.length < n) {
        let bestT = -1, bestScore = Infinity;
        for (let t = 0; t < N_TYPES; t++) {
          if (t === JOKER || work[t] === 0) continue;
          work[t]--;
          const need = bestNeed(work, []);
          work[t]++;
          if (need < bestScore) { bestScore = need; bestT = t; }
        }
        work[bestT]--;
        pass.push(bestT);
      }
    }
    return pass;
  }

  /*
   * Exposure calls on a discard: for each non-concealed card line, can the
   * caller take this tile and immediately expose a complete group of 3+
   * (using hand copies + jokers)? Returns available sizes with the joker
   * count each would spend. Discarded jokers are dead and can never be called.
   */
  function callOptions(c, exposures, tile) {
    if (tile === JOKER) return [];
    const sizes = new Map();
    for (const v of ALL_VARIANTS) {
      if (CARD[v.hand].concealed) continue;
      for (const grp of v.groups) {
        if (grp.tile !== tile || grp.size < 3) continue;
        c[tile]++;
        const compatible = variantNeed(c, exposures, v) !== Infinity;
        c[tile]--;
        if (!compatible) continue;
        const own = Math.min(c[tile], grp.size - 1);
        const jokersNeeded = grp.size - 1 - own;
        if (jokersNeeded <= c[JOKER]) {
          const prev = sizes.get(grp.size);
          if (!prev || jokersNeeded < prev.jokers) sizes.set(grp.size, { size: grp.size, jokers: jokersNeeded, hand: v.hand });
        }
      }
    }
    return [...sizes.values()].sort((a, b) => a.size - b.size);
  }

  global.Mahjong = {
    // tile helpers
    suitOf, numOf, isJoker, isFlower, tileName, copiesOf,
    CRAK, DOT, BAM, EAST, SOUTH, WEST, NORTH, SOAP, GREEN, RED, FLOWER, JOKER, N_TYPES,
    // deck
    rng, buildWall, counts,
    // card + evaluation
    CARD, ALL_VARIANTS, variantNeed, bestHands, bestNeed, isMahjongg,
    usefulCounts, evaluateDiscards, choosePass, callOptions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
