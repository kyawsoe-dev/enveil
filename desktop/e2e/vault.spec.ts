import { test, expect } from '@playwright/test';

test.describe('Vault unlock flow', () => {
  test('shows master auth screen when locked', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Master password')).toBeVisible();
  });

  test('shows unlock button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /unlock vault/i })).toBeVisible();
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('Master password');
    await expect(input).toHaveAttribute('type', 'password');
    await page.locator('button').filter({ has: page.locator('svg') }).first().click();
    await expect(input).toHaveAttribute('type', 'text');
  });

  test('unlock button disabled when input is empty', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /unlock vault/i });
    await expect(btn).toBeDisabled();
  });

  test('unlock button enabled when password entered', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Master password').fill('mypassword');
    const btn = page.getByRole('button', { name: /unlock vault/i });
    await expect(btn).toBeEnabled();
  });

  test('shows version on auth screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=/v\\d/')).toBeVisible();
  });
});
