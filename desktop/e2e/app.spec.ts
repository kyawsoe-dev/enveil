import { test, expect } from '@playwright/test';

test.describe('Page structure', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('__TAURI_IPC__')) errors.push(err.message);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('master auth card is centered', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.max-w-\\[400px\\]');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThan(100);
  });

  test('input is focused by default', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('Master password');
    await expect(input).toBeFocused();
  });
});
