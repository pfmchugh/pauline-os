// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Dismiss the boot screen so the desktop is interactive.
 * Clicking #boot calls endBoot(), which adds .done (display:none).
 */
async function skipBoot(page) {
  const boot = page.locator('#boot');
  await boot.click();
  await expect(boot).toHaveClass(/done/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await skipBoot(page);
});

test.describe('boot screen', () => {
  test('shows on load and can be skipped by clicking', async ({ page }) => {
    // beforeEach already skipped it; re-load to observe the initial state.
    await page.goto('/index.html');
    await expect(page.locator('#boot')).not.toHaveClass(/done/);
    await expect(page.locator('.boot-name')).toHaveText('Pauline OS');
    await page.locator('#boot').click();
    await expect(page.locator('#boot')).toHaveClass(/done/);
  });
});

test.describe('windows', () => {
  test('hello.txt is open on load', async ({ page }) => {
    await expect(page.locator('#win-contact')).toHaveClass(/open/);
  });

  test('icons open their windows; close button closes them', async ({ page }) => {
    for (const id of ['resume', 'contacts', 'mail', 'calendar']) {
      await page.locator(`.icon[data-open="${id}"]`).click();
      const win = page.locator(`#win-${id}`);
      await expect(win).toHaveClass(/open/);
      await win.locator('[data-action="close"]').click();
      await expect(win).not.toHaveClass(/open/);
    }
  });

  test('titlebar drag repositions a window', async ({ page }) => {
    const win = page.locator('#win-contact');
    const before = await win.evaluate((el) => el.style.left);
    const bar = win.locator('[data-drag]');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + 40, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 90, { steps: 5 });
    await page.mouse.up();
    const after = await win.evaluate((el) => el.style.left);
    expect(after).not.toBe(before);
  });

  test('zoom (maximize) toggles the maxed class', async ({ page }) => {
    const win = page.locator('#win-contact');
    await win.locator('[data-action="zoom"]').click();
    await expect(win).toHaveClass(/maxed/);
    await win.locator('[data-action="zoom"]').click();
    await expect(win).not.toHaveClass(/maxed/);
  });
});

test.describe('menu bar', () => {
  const openMenu = (page, name) =>
    page.locator(`.menu-item[data-menu="${name}"] .menu-label`).click();
  const clickCmd = (page, name, cmd) =>
    page.locator(`.menu-item[data-menu="${name}"] .menu-option[data-cmd="${cmd}"]`).click();

  test('clicking a menu opens its dropdown and the overlay', async ({ page }) => {
    await openMenu(page, 'file');
    await expect(page.locator('.menu-item[data-menu="file"]')).toHaveClass(/active/);
    await expect(page.locator('#menu-overlay')).toHaveClass(/on/);
    // click-away overlay closes it
    await page.locator('#menu-overlay').click();
    await expect(page.locator('.menu-item[data-menu="file"]')).not.toHaveClass(/active/);
  });

  test('File > Open Resume.pdf opens the resume window', async ({ page }) => {
    await openMenu(page, 'file');
    await clickCmd(page, 'file', 'open-resume');
    await expect(page.locator('#win-resume')).toHaveClass(/open/);
  });

  test('File > New Job Offer opens Mail', async ({ page }) => {
    await openMenu(page, 'file');
    await clickCmd(page, 'file', 'new-job-offer');
    await expect(page.locator('#win-mail')).toHaveClass(/open/);
  });

  test('File > Shut Down shows a joke dialog', async ({ page }) => {
    await openMenu(page, 'file');
    await clickCmd(page, 'file', 'shut-down');
    await expect(page.locator('#dialog')).toHaveClass(/on/);
    await expect(page.locator('#dialog-title')).toHaveText('Nice try.');
    await page.locator('#dialog-ok').click();
    await expect(page.locator('#dialog')).not.toHaveClass(/on/);
  });

  test('Edit > Copy Email Address shows the Copied! dialog', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write']).catch(() => {});
    await openMenu(page, 'edit');
    await clickCmd(page, 'edit', 'copy-email');
    await expect(page.locator('#dialog-title')).toHaveText('Copied!');
  });

  test('View > Toggle Scanlines flips the overlay', async ({ page }) => {
    await openMenu(page, 'view');
    await clickCmd(page, 'view', 'toggle-scanlines');
    await expect(page.locator('#scanlines')).toHaveClass(/on/);
    await openMenu(page, 'view');
    await clickCmd(page, 'view', 'toggle-scanlines');
    await expect(page.locator('#scanlines')).not.toHaveClass(/on/);
  });

  test('View > Clean Up Desktop wiggles the icons', async ({ page }) => {
    await openMenu(page, 'view');
    await clickCmd(page, 'view', 'clean-up');
    await expect(page.locator('#desktop-icons')).toHaveClass(/wiggle/);
    // the class is removed after the animation (~1s)
    await expect(page.locator('#desktop-icons')).not.toHaveClass(/wiggle/, { timeout: 2000 });
  });

  test('the Special items live under the Pauline OS brand menu', async ({ page }) => {
    const brandItem = page.locator('.menu-item[data-menu="special"]');
    await expect(brandItem.locator('.menu-label')).toHaveText(/Pauline ?OS/);
    await openMenu(page, 'special');
    await expect(brandItem).toHaveClass(/active/);
    for (const cmd of ['eject', 'empty-trash', 'restart']) {
      await expect(brandItem.locator(`.menu-option[data-cmd="${cmd}"]`)).toBeVisible();
    }
  });

  test('Pauline OS > Empty Trash clears items and opens the trash', async ({ page }) => {
    await openMenu(page, 'special');
    await clickCmd(page, 'special', 'empty-trash');
    await expect(page.locator('#win-trash')).toHaveClass(/open/);
    await expect(page.locator('.trash-item')).toHaveCount(0);
    await expect(page.locator('#win-trash')).toHaveClass(/trash-clean/);
  });

  test('Pauline OS > Restart replays the boot screen', async ({ page }) => {
    await openMenu(page, 'special');
    await clickCmd(page, 'special', 'restart');
    await expect(page.locator('#boot')).not.toHaveClass(/done/);
    await expect(page.locator('#boot')).toHaveClass(/done/, { timeout: 4000 });
  });

  for (const width of [375, 320]) {
    test(`menu bar fits a ${width}px viewport with the clock fully visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 667 });
      const bar = await page.locator('#menu-bar').evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
      const clock = await page.locator('#clock').boundingBox();
      expect(clock.x).toBeGreaterThanOrEqual(0);
      expect(clock.x + clock.width).toBeLessThanOrEqual(width);
      // narrow screens drop the date but must still show the time
      await expect(page.locator('#clock .clock-time')).toBeVisible();
      await expect(page.locator('#clock .clock-date')).toBeHidden();
    });
  }

  test('the clock shows date and time on desktop viewports', async ({ page }) => {
    await expect(page.locator('#clock .clock-date')).toBeVisible();
    await expect(page.locator('#clock .clock-time')).toBeVisible();
  });
});

test.describe('easter eggs', () => {
  test('clicking the clock cycles through joke labels', async ({ page }) => {
    const clock = page.locator('#clock');
    await clock.click();
    await expect(clock).toHaveText('Uptime: 15 years in QA');
    await clock.click();
    await expect(clock).toHaveText('0 bugs shipped today');
    await clock.click();
    // back to a real timestamp
    await expect(clock).not.toHaveText('0 bugs shipped today');
  });

  test('Konami code drops confetti', async ({ page }) => {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    for (const key of seq) await page.keyboard.press(key);
    await expect(page.locator('#confetti')).toHaveClass(/on/);
    await expect(page.locator('#confetti .piece')).toHaveCount(28);
  });

  test('the corgi appears and wanders', async ({ page }) => {
    // it first shows ~6s after load
    await expect(page.locator('#cat')).toHaveClass(/on/, { timeout: 9000 });
  });
});

test.describe('notepads', () => {
  test('focusing hello.txt reveals the full text', async ({ page }) => {
    const hello = page.locator('#hello-text');
    await hello.focus();
    await expect(hello).toHaveValue(/Say hi — I read everything\./);
  });

  test('README.md opens from inside the Projects folder', async ({ page }) => {
    await page.locator('.icon[data-open="projects"]').click();
    await page.locator('#open-readme').click();
    await expect(page.locator('#win-readme')).toHaveClass(/open/);
    await expect(page.locator('#readme-text')).toHaveValue(/pauline-os v2 \(you are here\)/);
  });
});

test.describe('mail', () => {
  const openMail = async (page) => {
    await page.locator('.icon[data-open="mail"]').click();
    await expect(page.locator('#win-mail')).toHaveClass(/open/);
  };

  /**
   * Stub the FormSubmit.co AJAX endpoint so tests never hit the real
   * service. Returns the list of intercepted request payloads.
   */
  const mockMailEndpoint = async (page, { status = 200 } = {}) => {
    const sent = [];
    await page.route('**/formsubmit.co/ajax/**', async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200
          ? { success: 'true', message: 'The form was submitted successfully.' }
          : { success: 'false', message: 'error' }),
      });
    });
    return sent;
  };

  const fillMail = async (page, from = 'someone@example.com') => {
    await page.fill('#mail-from', from);
    await page.fill('#mail-subject', 'Hello');
    await page.fill('#mail-message', 'Hi there');
  };

  test('submitting with empty fields shows an error', async ({ page }) => {
    await openMail(page);
    await page.locator('.mail-send').click();
    await expect(page.locator('#mail-error')).toHaveText('All fields are required.');
    await expect(page.locator('#mail-sent')).not.toHaveClass(/show/);
  });

  test('a malformed sender address is rejected without a network call', async ({ page }) => {
    const sent = await mockMailEndpoint(page);
    await openMail(page);
    await fillMail(page, 'not-an-email');
    await page.locator('.mail-send').click();
    await expect(page.locator('#mail-error')).toHaveText("That email doesn't look right.");
    await expect(page.locator('#mail-sent')).not.toHaveClass(/show/);
    expect(sent).toHaveLength(0);
  });

  test('a valid submission posts to FormSubmit and shows the sent screen', async ({ page }) => {
    const sent = await mockMailEndpoint(page);
    await openMail(page);
    await fillMail(page);
    await page.locator('.mail-send').click();
    await expect(page.locator('#mail-sent')).toHaveClass(/show/);
    await expect(page.locator('#mail-form')).toBeHidden();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      _replyto: 'someone@example.com',
      _subject: '[pauline-os] Hello',
      message: 'Hi there',
    });
  });

  test('a delivery failure shows an error and keeps the form', async ({ page }) => {
    await mockMailEndpoint(page, { status: 500 });
    await openMail(page);
    await fillMail(page);
    await page.locator('.mail-send').click();
    await expect(page.locator('#mail-error')).toHaveText(/Couldn't send/);
    await expect(page.locator('#mail-form')).toBeVisible();
    await expect(page.locator('#mail-sent')).not.toHaveClass(/show/);
    // the send button recovers so the visitor can retry
    await expect(page.locator('.mail-send')).toBeEnabled();
    await expect(page.locator('.mail-send')).toHaveText('Send ▸');
  });

  test('the honeypot field is invisible to visitors', async ({ page }) => {
    await openMail(page);
    const honey = page.locator('#mail-honey');
    await expect(honey).toHaveCount(1);
    await expect(honey).not.toBeInViewport();
    // keyboard users never land on it either
    await expect(honey).toHaveAttribute('tabindex', '-1');
  });

  test('a submission with the honeypot filled is silently discarded', async ({ page }) => {
    const sent = await mockMailEndpoint(page);
    await openMail(page);
    await fillMail(page);
    await page.locator('#mail-honey').evaluate((el) => { el.value = 'spam-bot'; });
    await page.locator('.mail-send').click();
    // the bot sees the normal success screen…
    await expect(page.locator('#mail-sent')).toHaveClass(/show/);
    // …but nothing was actually sent
    expect(sent).toHaveLength(0);
  });

  test('"Write another" resets the form', async ({ page }) => {
    await mockMailEndpoint(page);
    await openMail(page);
    await fillMail(page);
    await page.locator('.mail-send').click();
    await page.locator('#mail-reset').click();
    await expect(page.locator('#mail-form')).toBeVisible();
    await expect(page.locator('#mail-sent')).not.toHaveClass(/show/);
    await expect(page.locator('#mail-from')).toHaveValue('');
  });
});

test.describe('trash', () => {
  test('starts with three joke files', async ({ page }) => {
    await page.locator('#trash-icon').click();
    await expect(page.locator('.trash-item')).toHaveCount(3);
    await expect(page.locator('#trash-status')).toHaveText(/3 items/);
  });

  test('dragging a file out of the window deletes it', async ({ page }) => {
    await page.locator('#trash-icon').click();
    const items = page.locator('.trash-item');
    await expect(items).toHaveCount(3);

    const first = items.first();
    const box = await first.boundingBox();
    const size = page.viewportSize();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    // exceed the 6px drag threshold, then drop far outside the window
    await page.mouse.move(box.x + 40, box.y + 40, { steps: 3 });
    await page.mouse.move(size.width - 40, size.height - 40, { steps: 5 });
    await page.mouse.up();

    await expect(items).toHaveCount(2);
    await expect(page.locator('#trash-status')).toHaveText(/2 items/);
  });

  test('the icon lid sits flush on the can and overhangs it', async ({ page }) => {
    const lid = await page.locator('#trash-icon .icon-trash-top').boundingBox();
    const can = await page.locator('#trash-icon .icon-trash').boundingBox();
    // lid bottom edge touches the can's top edge (no floating gap)
    expect(Math.abs(lid.y + lid.height - can.y)).toBeLessThanOrEqual(1);
    // lid is wider than the can, like the classic desktop trash icon
    expect(lid.width).toBeGreaterThan(can.width);
  });

  test('Empty Trash button clears the list', async ({ page }) => {
    await page.locator('#trash-icon').click();
    await page.locator('#trash-empty-btn').click();
    await expect(page.locator('.trash-item')).toHaveCount(0);
    await expect(page.locator('#trash-empty')).toBeVisible();
  });
});
