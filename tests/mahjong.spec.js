// @ts-check
const { test, expect } = require('@playwright/test');

const GAME = '/games/mahjong/index.html';

/* Tile ids: 0-8 characters 1-9, 9-17 dots 1-9, 18-26 bamboo 1-9,
 * 27-33 honors (East South West North White Green Red). */

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
    await expect(page.locator('#win-games .folder-icon-label')).toHaveText('Mahjong Trainer');
  });

  test('the app iframe stays unloaded until the window is opened', async ({ page }) => {
    expect(await page.locator('#mahjong-iframe').getAttribute('src')).toBeNull();
    await page.locator('.icon[data-open="games"]').click();
    await page.locator('#open-mahjong').click();
    await expect(page.locator('#win-mahjong')).toHaveClass(/open/);
    await expect(page.locator('#mahjong-iframe')).toHaveAttribute('src', /embed=1/);
    // the app actually boots inside the window
    await expect(page.frameLocator('#mahjong-iframe').locator('.mj-title')).toBeVisible();
    await expect(page.frameLocator('#mahjong-iframe').locator('#lesson-title')).toHaveText('Welcome to Mahjong');
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

  const shanten = (page, tiles, open = 0) =>
    page.evaluate(([t, o]) => window.Mahjong.shanten(t, o), [tiles, open]);

  test('a complete hand scores -1 (won)', async ({ page }) => {
    // m123 m456 m789 + p1 pair + s123
    expect(await shanten(page, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 18, 19, 20])).toBe(-1);
  });

  test('one tile short of complete is 0 (ready / tenpai)', async ({ page }) => {
    expect(await shanten(page, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 18, 19])).toBe(0);
  });

  test('thirteen unconnected tiles are far from ready', async ({ page }) => {
    const junk = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    expect(await shanten(page, junk)).toBeGreaterThanOrEqual(6);
  });

  test('open melds count as finished sets', async ({ page }) => {
    // three claimed melds + m123 + pair of p1 = a won hand
    expect(await page.evaluate(() => window.Mahjong.isWinningHand([0, 1, 2, 9, 9], 3))).toBe(true);
  });

  test('chowOptions finds every run the hand can build around a claim', async ({ page }) => {
    // hand holds p3 p4 p6 p7; claiming p5 can make 3-4-5, 4-5-6, or 5-6-7
    const opts = await page.evaluate(() => window.Mahjong.chowOptions([11, 12, 14, 15], 13));
    expect(opts).toEqual([[11, 12], [12, 14], [14, 15]]);
    // honors can never be chowed
    expect(await page.evaluate(() => window.Mahjong.chowOptions([27, 27], 27))).toEqual([]);
  });

  test('evaluateDiscards recommends cutting the lone honor', async ({ page }) => {
    // m234 p345 s456 s78 p88 + lone East: dropping East leaves the hand ready
    const rows = await page.evaluate(() =>
      window.Mahjong.evaluateDiscards([1, 2, 3, 11, 12, 13, 21, 22, 23, 24, 25, 16, 16, 27], 0));
    expect(rows[0].tile).toBe(27);
    expect(rows[0].shanten).toBe(0);
    expect(rows[0].ukeire).toBeGreaterThan(0);
  });

  test('winPatterns spots a full flush', async ({ page }) => {
    const pats = await page.evaluate(() =>
      window.Mahjong.winPatterns([0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 4, 4], 'tsumo'));
    expect(pats.join(' ')).toMatch(/Full Flush/);
    expect(pats.join(' ')).toMatch(/Self-draw/);
  });
});

test.describe('learn mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME);
  });

  test('starts on lesson 1 with navigation', async ({ page }) => {
    await expect(page.locator('#lesson-kicker')).toHaveText('LESSON 1 OF 8');
    await expect(page.locator('#lesson-title')).toHaveText('Welcome to Mahjong');
    await expect(page.locator('#lesson-prev')).toBeDisabled();
    await page.locator('#lesson-next').click();
    await expect(page.locator('#lesson-title')).toHaveText('Meet the tiles');
    await expect(page.locator('#lesson-prev')).toBeEnabled();
  });

  test('progress dots jump straight to a lesson', async ({ page }) => {
    await page.locator('#lesson-dots .dot').nth(4).click();
    await expect(page.locator('#lesson-kicker')).toHaveText('LESSON 5 OF 8');
  });

  test('quizzes grade the answer and explain why', async ({ page }) => {
    await page.locator('#lesson-dots .dot').nth(2).click(); // "The three kinds of groups"
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
    await expect(page.locator('#hand .tile')).toHaveCount(14); // dealer draws first
  });
});

test.describe('play mode', () => {
  const url = GAME + '?mode=play&fast=1&seed=42';

  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  test('deals 13 tiles to each bot and 14 to you (East draws first)', async ({ page }) => {
    await expect(page.locator('#hand .tile')).toHaveCount(14);
    for (const opp of ['opp-1', 'opp-2', 'opp-3']) {
      await expect(page.locator(`#${opp} .opp-backs .tile.back`)).toHaveCount(13);
    }
    await expect(page.locator('#wall-count')).toHaveText(/Wall: 83 tiles/); // 136 - 52 - 1 drawn
  });

  test('the coach explains the turn and stars a recommended discard', async ({ page }) => {
    await expect(page.locator('#coach-body')).toContainText('Best discard:');
    await expect(page.locator('#coach-body')).toContainText('Why:');
    await expect(page.locator('#hand .tile.reco')).toHaveCount(1);
  });

  test('discarding hands the turn to the bots, then control returns', async ({ page }) => {
    await page.locator('#hand .tile.reco').click();
    await expect(page.locator('#hand .tile')).toHaveCount(13);
    await expect(page.locator('#river-0 .tile')).toHaveCount(1);
    // bots play at fast speed until it's your decision again (turn or claim)
    await page.waitForFunction(() => {
      const s = window.__mj.state;
      return s.over || s.pending || (s.turn === 0 && s.phase === 'discard');
    });
    const state = await page.evaluate(() => window.__mj.state);
    expect(state.over || state.pending || state.handSizes[0] === 14).toBeTruthy();
  });

  test('turning the coach off hides recommendations', async ({ page }) => {
    await page.locator('#coach-toggle').uncheck();
    await expect(page.locator('#coach')).toHaveClass(/coach-off/);
    await expect(page.locator('#hand .tile.reco')).toHaveCount(0);
    await expect(page.locator('#coach-body')).toContainText('flying solo');
    await page.locator('#coach-toggle').check();
    await expect(page.locator('#hand .tile.reco')).toHaveCount(1);
  });

  test('New game re-deals a fresh hand', async ({ page }) => {
    await page.locator('#hand .tile.reco').click();
    await expect(page.locator('#river-0 .tile')).toHaveCount(1);
    await page.locator('#new-game').click();
    await expect(page.locator('#river-0 .tile')).toHaveCount(0);
    await expect(page.locator('#hand .tile')).toHaveCount(14);
  });

  test('embed flag hides the home breadcrumb', async ({ page }) => {
    await expect(page.locator('#crumb-home')).toBeVisible();
    await page.goto(url + '&embed=1');
    await expect(page.locator('#crumb-home')).toBeHidden();
  });
});
