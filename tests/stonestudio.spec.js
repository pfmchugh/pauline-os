// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Stone Studio', () => {
  test('loads the studio and builds the BEARS sample template', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('stonestudio/');
    await expect(page.locator('h1')).toContainText('Stone Studio');
    await expect(page.getByText('Coming soon')).toHaveCount(0);
    await expect(page.locator('#preview svg circle').first()).toBeVisible();
    await expect(page.locator('#svgDownload')).toBeEnabled();
    const count = Number((await page.locator('#count').textContent())?.replace(/,/g, ''));
    expect(count).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('switching to outline mode rebuilds the template', async ({ page }) => {
    await page.goto('stonestudio/');
    await expect(page.locator('#svgDownload')).toBeEnabled();
    const before = await page.evaluate(() => window.studioResult.revision);
    await page.locator('#mode').selectOption('outline');
    await expect(page.locator('#rows')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => window.studioResult.revision)).toBeGreaterThan(before);
    await expect(page.locator('#svgDownload')).toBeEnabled();
  });
});
