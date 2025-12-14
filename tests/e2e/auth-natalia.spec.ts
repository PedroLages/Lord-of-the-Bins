import { test, expect } from '@playwright/test';

test.describe('Authentication - Natalia User', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should login successfully with Natalia credentials', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    // Capture network errors
    const networkErrors: string[] = [];
    page.on('requestfailed', request => {
      networkErrors.push(`Failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify login page is shown
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    // Fill in Natalia's credentials
    await page.getByPlaceholder('EMP001 or email@example.com').fill('natalia@bol.com');
    await page.getByPlaceholder('••••••••').fill('12345');

    // Take screenshot before clicking
    await page.screenshot({ path: 'test-results/natalia-before-login.png', fullPage: true });

    // Click submit
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for authentication to complete (increase timeout)
    await page.waitForTimeout(3000);

    // Take screenshot after clicking
    await page.screenshot({ path: 'test-results/natalia-after-login.png', fullPage: true });

    console.log('=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => console.log(msg));

    console.log('\n=== NETWORK ERRORS ===');
    networkErrors.forEach(err => console.log(err));

    console.log('\n=== CURRENT URL ===');
    console.log(page.url());

    // Check for successful login indicators
    const hasError = await page.getByText(/login failed|invalid|error/i).isVisible().catch(() => false);
    const hasLoginPage = await page.getByRole('heading', { name: 'Welcome back' }).isVisible().catch(() => false);
    const hasDashboard = await page.getByText(/Dashboard|Schedule|Team/i).isVisible().catch(() => false);
    const hasSidebar = await page.getByText(/Natalia/i).isVisible().catch(() => false);

    console.log('\n=== STATUS ===');
    console.log('Has error message:', hasError);
    console.log('Still on login page:', hasLoginPage);
    console.log('Dashboard visible:', hasDashboard);
    console.log('Natalia name visible:', hasSidebar);

    // Assertions
    expect(hasError).toBe(false); // No error message
    expect(hasLoginPage).toBe(false); // Should leave login page
    expect(hasDashboard || hasSidebar).toBe(true); // Should see dashboard or sidebar
  });
});
