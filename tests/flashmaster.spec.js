// @ts-check
const { test, expect } = require('@playwright/test');

const GAME = '/games/flashmaster/index.html';

test.describe('desktop: FlashMaster in the Games folder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // skip the boot screen; on a slow machine it may auto-dismiss first
    await page.locator('#boot').click({ timeout: 2000 }).catch(() => {});
    await expect(page.locator('#boot')).toHaveClass(/done/);
  });

  test('the Games folder lists FlashMaster next to the Mahjong Trainer', async ({ page }) => {
    await page.locator('.icon[data-open="games"]').click();
    await expect(page.locator('#win-games')).toHaveClass(/open/);
    await expect(page.locator('#open-flashmaster .folder-icon-label')).toHaveText('FlashMaster');
    await expect(page.locator('#win-games .folder-status')).toHaveText(/2 items/);
  });

  test('the app iframe stays unloaded until the window is opened', async ({ page }) => {
    expect(await page.locator('#flashmaster-iframe').getAttribute('src')).toBeNull();
    await page.locator('.icon[data-open="games"]').click();
    await page.locator('#open-flashmaster').click();
    await expect(page.locator('#win-flashmaster')).toHaveClass(/open/);
    await expect(page.locator('#flashmaster-iframe')).toHaveAttribute('src', /embed=1/);
    // the device actually boots inside the window
    const frame = page.frameLocator('#flashmaster-iframe');
    await expect(frame.locator('#lcd-main')).toHaveText('FLASHMASTER');
  });

  test('the window offers a full-screen escape hatch', async ({ page }) => {
    await page.locator('.icon[data-open="games"]').click();
    await page.locator('#open-flashmaster').click();
    await expect(page.locator('#win-flashmaster .app-bar a')).toHaveAttribute('href', 'games/flashmaster/');
  });
});

test.describe('engine', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME + '?fast=1');
  });

  test('level pools are cumulative and level 9 covers every fact', async ({ page }) => {
    const sizes = await page.evaluate(() => {
      const FM = window.FlashMaster;
      return {
        l1: FM.factsFor('+', 1).length,
        l9: FM.factsFor('+', 9).length,
        l1HasBigFact: FM.factsFor('+', 1).some((p) => p.a >= 2 && p.b >= 2),
        l9Mul: FM.factsFor('×', 9).length,
      };
    });
    expect(sizes.l9).toBe(100);        // all 10×10 addition facts
    expect(sizes.l9Mul).toBe(100);
    expect(sizes.l1).toBeLessThan(sizes.l9);
    expect(sizes.l1HasBigFact).toBe(false); // level 1 is only the 0s and 1s tables
  });

  test('division never divides by zero and inverts multiplication', async ({ page }) => {
    const ok = await page.evaluate(() => {
      const facts = window.FlashMaster.factsFor('÷', 9);
      return facts.every((p) => p.b !== 0 && p.a === p.answer * p.b);
    });
    expect(ok).toBe(true);
  });

  test('a table runs up 0–9 and back down', async ({ page }) => {
    const t = await page.evaluate(() => window.FlashMaster.tableFor('×', 4));
    expect(t.length).toBe(19);
    expect(t[0]).toMatchObject({ a: 4, b: 0, answer: 0 });
    expect(t[9]).toMatchObject({ a: 4, b: 9, answer: 36 });
    expect(t[18]).toMatchObject({ a: 4, b: 0, answer: 0 });
  });

  test('the special-problems bank keeps the 15 most recent misses, no duplicates', async ({ page }) => {
    const bank = await page.evaluate(() => {
      const FM = window.FlashMaster;
      let bank = [];
      for (let i = 0; i <= 9; i++) {
        for (let j = 0; j <= 9; j++) bank = FM.recordMiss(bank, FM.problem(i, '+', j));
      }
      bank = FM.recordMiss(bank, FM.problem(9, '+', 9)); // repeat: moves, not grows
      return bank;
    });
    expect(bank.length).toBe(15);
    expect(bank[14]).toMatchObject({ a: 9, op: '+', b: 9 });
  });
});

test.describe('gameplay', () => {
  /** Read the current problem off the LCD, e.g. "3 + 5 = _". */
  async function readProblem(page) {
    const text = await page.locator('#lcd-main').textContent();
    const m = /^(\d+) (.) (\d+) =/.exec(text || '');
    if (!m) throw new Error('no problem on LCD: ' + text);
    const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
    const answer = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    return { a, op, b, answer, text };
  }

  async function type(page, digits) {
    for (const d of String(digits)) {
      await expect(page.locator('#lcd')).not.toHaveClass(/busy/);
      await page.locator(`.digit[data-digit="${d}"]`).click();
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME + '?fast=1&seed=7');
    // pin the settings the tests assume, regardless of stored state
    await page.evaluate(() => localStorage.setItem('fm-settings', JSON.stringify({ op: '+', level: 3, timeIdx: 0, sound: false })));
    await page.reload();
    await expect(page.locator('#lcd-main')).toHaveText('FLASHMASTER');
  });

  test('the selector keys cycle operation, level, and time limit', async ({ page }) => {
    await expect(page.locator('#lcd-status')).toHaveText(/\+\s+LEVEL 3\s+TIME --/);
    await page.locator('#key-op').click();
    await expect(page.locator('#lcd-status')).toHaveText(/−\s+LEVEL 3\s+TIME --/);
    await page.locator('#key-level').click();
    await expect(page.locator('#lcd-status')).toHaveText(/−\s+LEVEL 4\s+TIME --/);
    await page.locator('#key-time').click();
    await expect(page.locator('#lcd-status')).toHaveText(/−\s+LEVEL 4\s+TIME 30s/);
  });

  test('Table: In Order walks the 3s table and scores a clean run', async ({ page }) => {
    await page.locator('[data-activity="table-order"]').click();
    await expect(page.locator('#lcd-main')).toHaveText('3 + 0 = _');
    for (let i = 0; i < 19; i++) {
      const p = await readProblem(page);
      await type(page, p.answer);
      // answers auto-submit at the right digit count; wait for the flash to clear
      await expect(page.locator('#lcd')).not.toHaveClass(/busy/);
    }
    await expect(page.locator('#lcd-status')).toHaveText('TABLE: IN ORDER DONE');
    await expect(page.locator('#lcd-main')).toHaveText('SCORE 19/19');
  });

  test('a missed problem repeats, reveals its answer after two misses, and lands in Special Problems', async ({ page }) => {
    await page.locator('[data-activity="table-order"]').click();
    await expect(page.locator('#lcd-main')).toHaveText('3 + 0 = _');

    await type(page, '9'); // wrong once → try again, same problem
    await expect(page.locator('#lcd')).not.toHaveClass(/busy/);
    await expect(page.locator('#lcd-main')).toHaveText('3 + 0 = _');

    await type(page, '9'); // wrong twice → the device shows the answer
    await expect(page.locator('#lcd-sub')).toHaveText('ANSWER IS 3 — KEY IT IN');

    await type(page, '3'); // keying it in moves on, but the point is lost
    await expect(page.locator('#lcd-main')).toHaveText('3 + 1 = _');
    await expect(page.locator('#lcd-sub')).toHaveText('SCORE 0');

    // the miss is remembered for the Special Problems activity
    await page.locator('[data-activity="special"]').click();
    await expect(page.locator('#lcd-status')).toHaveText(/SPECIAL PROBLEMS/);
    await expect(page.locator('#lcd-main')).toHaveText('3 + 0 = _');
    // answering it correctly first try clears it from the bank
    await type(page, '3');
    await expect(page.locator('#lcd-status')).toContainText('DONE');
    const bank = await page.evaluate(() => JSON.parse(localStorage.getItem('fm-special') || '[]'));
    expect(bank.length).toBe(0);
  });

  test('Special Problems with an empty bank politely declines', async ({ page }) => {
    await page.locator('[data-activity="special"]').click();
    await expect(page.locator('#lcd-sub')).toHaveText('NO SPECIAL PROBLEMS — GO MISS SOME');
    await expect(page.locator('#lcd-main')).toHaveText('FLASHMASTER');
  });

  test('Test is single-attempt: a wrong answer shows the fact and moves on', async ({ page }) => {
    await page.locator('[data-activity="test"]').click();
    const p = await readProblem(page);
    const wrong = p.answer === 0 ? 1 : 0;
    await type(page, wrong);
    await page.keyboard.press('Enter'); // commit early if the entry is short
    // ✗ plus the full fact flashes, then the next problem appears
    await expect(page.locator('#lcd-sub')).toHaveText(`✗ ${p.a} ${p.op} ${p.b} = ${p.answer}`);
    await expect(page.locator('#lcd')).not.toHaveClass(/busy/);
    const next = await readProblem(page);
    expect(next.text).not.toBe(p.text);
  });

  test('a timed Test shows a live countdown', async ({ page }) => {
    // the shortest limit (30s) is one click away
    await page.locator('#key-time').click();
    await expect(page.locator('#lcd-status')).toHaveText(/TIME 30s/);
    await page.locator('[data-activity="test"]').click();
    await expect(page.locator('#lcd-status')).toContainText('0:30');
    await expect(page.locator('#lcd-status')).toHaveText(/0:2\d/, { timeout: 5000 });
  });

  test('the power key turns the device off and back on', async ({ page }) => {
    await page.locator('#key-power').click();
    await expect(page.locator('#lcd-main')).toHaveText('');
    // keys are dead while off
    await page.locator('[data-activity="practice"]').click();
    await expect(page.locator('#lcd-main')).toHaveText('');
    await page.locator('#key-power').click();
    await expect(page.locator('#lcd-main')).toHaveText('FLASHMASTER');
  });
});
