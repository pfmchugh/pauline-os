// @ts-check
const { test, expect } = require('@playwright/test');

const GAME = '/games/mahjong/index.html';

/* Tile ids: 0-8 craks 1-9, 9-17 dots 1-9, 18-26 bams 1-9,
 * 27-30 winds (E S W N), 31 soap, 32 green, 33 red, 34 flower, 35 joker. */
const F = 34, J = 35;

test.describe('desktop: Games folder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // skip the boot screen; on a slow machine it may auto-dismiss first
    await page.locator('#boot').click({ timeout: 2000 }).catch(() => {});
    await expect(page.locator('#boot')).toHaveClass(/done/);
  });

  test('Games icon opens the folder with the Mahjong Trainer inside', async ({ page }) => {
    await page.locator('.icon[data-open="games"]').click();
    await expect(page.locator('#win-games')).toHaveClass(/open/);
    await expect(page.locator('#open-mahjong')).toBeVisible();
    await expect(page.locator('#open-mahjong .folder-icon-label')).toHaveText('Mahjong Trainer');
  });

  test('the app iframe stays unloaded until the window is opened', async ({ page }) => {
    expect(await page.locator('#mahjong-iframe').getAttribute('src')).toBeNull();
    await page.locator('.icon[data-open="games"]').click();
    await page.locator('#open-mahjong').click();
    await expect(page.locator('#win-mahjong')).toHaveClass(/open/);
    await expect(page.locator('#mahjong-iframe')).toHaveAttribute('src', /embed=1/);
    // the app actually boots inside the window
    await expect(page.frameLocator('#mahjong-iframe').locator('.mj-title')).toBeVisible();
    await expect(page.frameLocator('#mahjong-iframe').locator('#lesson-title')).toHaveText('Welcome to American Mah Jongg');
  });

  test('the window offers a full-screen escape hatch', async ({ page }) => {
    await page.locator('.icon[data-open="games"]').click();
    await page.locator('#open-mahjong').click();
    await expect(page.locator('#win-mahjong .app-bar a')).toHaveAttribute('href', 'games/mahjong/');
  });
});

test.describe('engine', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME);
  });

  const evalIn = (page, fn, arg) => page.evaluate(fn, arg);

  test('every hand on the practice card is exactly 14 tiles', async ({ page }) => {
    const bad = await page.evaluate(() =>
      window.Mahjong.CARD.filter((h) =>
        h.variants().some((v) => v.reduce((a, g) => a + g.size, 0) !== 14)).map((h) => h.id));
    expect(bad).toEqual([]);
  });

  test('a complete like-numbers hand is Mah Jongg', async ({ page }) => {
    // FF + kong of 5s in craks, dots, and bams
    const win = await evalIn(page, ([f]) =>
      window.Mahjong.isMahjongg(window.Mahjong.counts([f, f, 4, 4, 4, 4, 13, 13, 13, 13, 22, 22, 22, 22]), []), [F]);
    expect(win).toBe(true);
  });

  test('jokers substitute in kongs but never in the flower pair', async ({ page }) => {
    const [inKong, inPair] = await evalIn(page, ([f, j]) => {
      const M = window.Mahjong;
      return [
        M.isMahjongg(M.counts([f, f, 4, 4, 4, j, 13, 13, j, j, 22, 22, 22, 22]), []),
        M.isMahjongg(M.counts([f, j, 4, 4, 4, 4, 13, 13, 13, 13, 22, 22, 22, 22]), []),
      ];
    }, [F, J]);
    expect(inKong).toBe(true);
    expect(inPair).toBe(false);
  });

  test('an exposed kong counts toward the hand', async ({ page }) => {
    const win = await evalIn(page, ([f]) =>
      window.Mahjong.isMahjongg(
        window.Mahjong.counts([f, f, 13, 13, 13, 13, 22, 22, 22, 22]),
        [{ tile: 4, size: 4, jokers: 0 }]), [F]);
    expect(win).toBe(true);
  });

  test('concealed hands reject exposures', async ({ page }) => {
    const ok = await page.evaluate(() => {
      const M = window.Mahjong;
      const rows = M.bestHands(M.counts([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]), [{ tile: 8, size: 3, jokers: 0 }]);
      return rows.every((r) => !M.CARD[r.hand].concealed);
    });
    expect(ok).toBe(true);
  });

  test('callOptions offers pung and kong with joker costs; discarded jokers are dead', async ({ page }) => {
    const [opts, jokerCall] = await evalIn(page, ([f, j]) => {
      const M = window.Mahjong;
      const c = M.counts([4, 4, j, 13, 13, 22, 22, f, f, 8, 8, 8, 8]);
      return [M.callOptions(c, [], 4), M.callOptions(c, [], j)];
    }, [F, J]);
    expect(opts.map((o) => o.size)).toContain(3);
    expect(jokerCall).toEqual([]);
  });

  test('the Charleston picker never passes jokers', async ({ page }) => {
    const pass = await evalIn(page, ([j]) => {
      const M = window.Mahjong;
      return M.choosePass(M.counts([j, j, j, 4, 4, 13, 13, 27, 29, 30, 8, 17, 26]), 3);
    }, [J]);
    expect(pass).toHaveLength(3);
    expect(pass).not.toContain(J);
  });

  test('quints are reachable only through jokers', async ({ page }) => {
    const rows = await evalIn(page, ([f, j]) => {
      const M = window.Mahjong;
      // 4 flowers, kong of 3 bams, kong of 3 dots, a joker, one stray
      const c = M.counts([f, f, f, f, 20, 20, 20, 20, j, 11, 11, 11, 11, 2]);
      return M.evaluateDiscards(c, [], null).slice(0, 1)
        .map((r) => ({ tile: r.tile, need: r.need, target: M.CARD[r.target].id }));
    }, [F, J]);
    expect(rows[0].target).toBe('quints');
    expect(rows[0].need).toBe(1);
  });
});

test.describe('learn mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME);
  });

  test('starts on lesson 1 with navigation', async ({ page }) => {
    await expect(page.locator('#lesson-kicker')).toHaveText('LESSON 1 OF 8');
    await expect(page.locator('#lesson-title')).toHaveText('Welcome to American Mah Jongg');
    await expect(page.locator('#lesson-prev')).toBeDisabled();
    await page.locator('#lesson-next').click();
    await expect(page.locator('#lesson-title')).toHaveText('Meet the tiles');
    await expect(page.locator('#lesson-prev')).toBeEnabled();
  });

  test('the card lesson renders the full practice card', async ({ page }) => {
    await page.locator('#lesson-dots .dot').nth(2).click();
    await expect(page.locator('#lesson-title')).toHaveText(/card/i);
    await expect(page.locator('#lesson-body .card-hand')).toHaveCount(11);
    await expect(page.locator('#lesson-body .card-cat').first()).toHaveText('ANY LIKE NUMBERS');
  });

  test('quizzes grade the answer and explain why', async ({ page }) => {
    await page.locator('#lesson-dots .dot').nth(3).click(); // the Charleston
    const quiz = page.locator('.quiz');
    await quiz.locator('.q-opt[data-ok="0"]').first().click();
    await expect(quiz.locator('.q-fb')).toHaveClass(/bad/);
    await quiz.locator('.q-opt[data-ok="1"]').click();
    await expect(quiz.locator('.q-fb')).toHaveClass(/good/);
    await expect(quiz.locator('.q-opt[data-ok="1"]')).toHaveClass(/right/);
  });

  test('the last lesson launches a guided game', async ({ page }) => {
    await page.locator('#lesson-dots .dot').nth(7).click();
    await page.locator('#start-guided').click();
    await expect(page.locator('#play')).toBeVisible();
    await expect(page.locator('#learn')).toBeHidden();
    // the game opens in the Charleston with 13 tiles
    await expect(page.locator('#hand .tile')).toHaveCount(13);
    await expect(page.locator('#pass-btn')).toBeVisible();
  });
});

test.describe('play mode', () => {
  const url = GAME + '?mode=play&fast=1&seed=42';

  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  /** Complete the three Charleston passes using the coach's picks. */
  async function runCharleston(page) {
    for (let i = 0; i < 3; i++) {
      await page.locator('#pass-suggest').click();
      await expect(page.locator('#hand .tile.sel')).toHaveCount(3);
      await page.locator('#pass-btn').click();
    }
    await page.waitForFunction(() => {
      const s = window.__mj.state;
      return s.over || s.pending || (s.turn === 0 && s.phase === 'discard');
    });
  }

  test('deals 13 tiles each and opens in the Charleston', async ({ page }) => {
    await expect(page.locator('#hand .tile')).toHaveCount(13);
    for (const opp of ['opp-1', 'opp-2', 'opp-3']) {
      await expect(page.locator(`#${opp} .opp-backs .tile.back`)).toHaveCount(13);
    }
    await expect(page.locator('#wall-count')).toHaveText(/Charleston · pass 1\/3/);
    await expect(page.locator('#pass-btn')).toBeDisabled();
    await expect(page.locator('#coach-body')).toContainText('Charleston');
  });

  test('selecting three tiles enables the pass; three passes start play', async ({ page }) => {
    await runCharleston(page);
    const state = await page.evaluate(() => window.__mj.state);
    expect(state.passNum).toBe(3);
    // East drew a 14th tile (unless a call is already pending)
    expect(state.over || state.pending || state.handSizes[0] === 14).toBeTruthy();
    await expect(page.locator('#wall-count')).toHaveText(/Wall: \d+ tiles/);
  });

  test('after the Charleston the coach names a card line and stars a discard', async ({ page }) => {
    await runCharleston(page);
    const state = await page.evaluate(() => window.__mj.state);
    test.skip(state.pending || state.over, 'seeded game opened with a call decision');
    await expect(page.locator('#coach-body')).toContainText('Best line:');
    await expect(page.locator('#coach-body')).toContainText('Best discard:');
    await expect(page.locator('#hand .tile.reco')).toHaveCount(1);
  });

  test('discarding hands the turn to the bots, then control returns', async ({ page }) => {
    await runCharleston(page);
    const state = await page.evaluate(() => window.__mj.state);
    test.skip(state.pending || state.over, 'seeded game opened with a call decision');
    await page.locator('#hand .tile.reco').click();
    await expect(page.locator('#hand .tile')).toHaveCount(13);
    await expect(page.locator('#river-0 .tile')).toHaveCount(1);
    await page.waitForFunction(() => {
      const s = window.__mj.state;
      return s.over || s.pending || (s.turn === 0 && s.phase === 'discard' && s.handSizes[0] === 14);
    });
  });

  test('the card panel shows live tiles-away badges', async ({ page }) => {
    await page.locator('#card-btn').click();
    await expect(page.locator('#card-panel')).toBeVisible();
    await expect(page.locator('#card-panel .card-hand')).toHaveCount(11);
    await expect(page.locator('#card-panel .card-badge').first()).toBeVisible();
    await expect(page.locator('#card-panel .card-badge.best')).toHaveText(/\d+ away/);
    await page.locator('#card-btn').click();
    await expect(page.locator('#card-panel')).toBeHidden();
  });

  test('turning the coach off hides recommendations', async ({ page }) => {
    await page.locator('#coach-toggle').uncheck();
    await expect(page.locator('#coach')).toHaveClass(/coach-off/);
    await expect(page.locator('#coach-body')).toContainText('flying solo');
    await page.locator('#coach-toggle').check();
    await expect(page.locator('#coach-body')).toContainText('Coach would pass:');
  });

  test('New game re-deals back into the Charleston', async ({ page }) => {
    await runCharleston(page);
    await page.locator('#new-game').click();
    await expect(page.locator('#wall-count')).toHaveText(/Charleston · pass 1\/3/);
    await expect(page.locator('#hand .tile')).toHaveCount(13);
    await expect(page.locator('#river-0 .tile')).toHaveCount(0);
  });

  test('embed flag hides the home breadcrumb', async ({ page }) => {
    await expect(page.locator('#crumb-home')).toBeVisible();
    await page.goto(url + '&embed=1');
    await expect(page.locator('#crumb-home')).toBeHidden();
  });
});
