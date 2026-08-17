/* FlashMaster engine — pure math-fact logic, no DOM.
 * Exposed as window.FlashMaster so the UI (game.js) and Playwright tests share it.
 *
 * Modeled on the FlashMaster handheld: four operations, nine cumulative
 * levels, six activities, eight per-activity time limits, and a memory of
 * the 15 most recently missed problems ("Special Problems").
 */
(function (global) {
  'use strict';

  const OPS = ['+', '−', '×', '÷'];

  const ACTIVITIES = [
    { id: 'table-order', label: 'TABLE: IN ORDER' },
    { id: 'table-random', label: 'TABLE: NOT IN ORDER' },
    { id: 'practice', label: 'PRACTICE' },
    { id: 'test', label: 'TEST' },
    { id: 'flashcards', label: 'FLASHCARDS' },
    { id: 'special', label: 'SPECIAL PROBLEMS' },
  ];

  // Whole-activity time limits, like the handheld's eight choices plus "off".
  const TIME_LIMITS = [null, 30, 45, 60, 75, 90, 120, 150, 180];

  const SESSION_LENGTH = 30; // problems per Practice / Test / Flashcards run
  const SPECIAL_MAX = 15;    // the device remembers the 15 most recent misses

  function problem(a, op, b) {
    let answer;
    if (op === '+') answer = a + b;
    else if (op === '−') answer = a - b;
    else if (op === '×') answer = a * b;
    else answer = a / b;
    return { a, op, b, answer, key: a + op + b };
  }

  /* Cumulative difficulty pool for a level. Level n covers the 0s table
   * through the ns table (both orders), so level 9 is every basic fact.
   * Subtraction and division problems are the inverses of those facts. */
  function factsFor(op, level) {
    const out = [];
    const seen = new Set();
    for (let a = 0; a <= 9; a++) {
      for (let b = 0; b <= 9; b++) {
        if (Math.min(a, b) > level) continue;
        let p;
        if (op === '+') p = problem(a, '+', b);
        else if (op === '−') p = problem(a + b, '−', b);
        else if (op === '×') p = problem(a, '×', b);
        else {
          if (b === 0) continue; // never divide by zero
          p = problem(a * b, '÷', b);
        }
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        out.push(p);
      }
    }
    return out;
  }

  /* One table for the Tables activities: the level number is the table.
   * Ascending 0–9 then back down, the way the handheld runs a table. */
  function tableFor(op, level) {
    const up = [];
    for (let b = 0; b <= 9; b++) {
      if (op === '+') up.push(problem(level, '+', b));
      else if (op === '−') up.push(problem(level + b, '−', level));
      else if (op === '×') up.push(problem(level, '×', b));
      else up.push(problem(level * b, '÷', level));
    }
    return up.concat(up.slice(0, -1).reverse());
  }

  function shuffle(arr, rand) {
    const r = rand || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Draw `count` problems from a pool without immediate repeats: deal the
   * whole shuffled pool, reshuffle, keep dealing until count is reached. */
  function deal(pool, count, rand) {
    const out = [];
    while (out.length < count) {
      const hand = shuffle(pool, rand);
      // avoid the same problem back to back across reshuffles
      if (out.length && hand.length > 1 && hand[0].key === out[out.length - 1].key) {
        hand.push(hand.shift());
      }
      for (const p of hand) {
        if (out.length < count) out.push(p);
      }
    }
    return out;
  }

  /* Build the problem list plus the rules the UI enforces for a session.
   * `special` is the missed-problem bank as [{a, op, b}, ...].
   * repeatMissed: retry until correct, answer revealed after two misses.
   * Single-attempt activities (test, flashcards) move on after one try. */
  function buildSession(activity, op, level, opts) {
    const o = opts || {};
    const rand = o.rand || Math.random;
    let problems;
    let repeatMissed = true;
    let timed = false;
    if (activity === 'table-order') {
      problems = tableFor(op, level);
    } else if (activity === 'table-random') {
      problems = shuffle(tableFor(op, level), rand);
    } else if (activity === 'practice' || activity === 'test' || activity === 'flashcards') {
      problems = deal(factsFor(op, level), SESSION_LENGTH, rand);
      repeatMissed = activity === 'practice';
      timed = activity === 'practice' || activity === 'test';
    } else if (activity === 'special') {
      problems = shuffle((o.special || []).map((p) => problem(p.a, p.op, p.b)), rand);
    } else {
      throw new Error('unknown activity: ' + activity);
    }
    return { activity, op, level, problems, repeatMissed, timed };
  }

  /* Record a miss in the special-problems bank (most recent last, capped). */
  function recordMiss(bank, p) {
    const next = bank.filter((q) => q.a + q.op + q.b !== p.key);
    next.push({ a: p.a, op: p.op, b: p.b });
    return next.slice(-SPECIAL_MAX);
  }

  global.FlashMaster = {
    OPS, ACTIVITIES, TIME_LIMITS, SESSION_LENGTH, SPECIAL_MAX,
    problem, factsFor, tableFor, shuffle, deal, buildSession, recordMiss,
  };
})(window);
