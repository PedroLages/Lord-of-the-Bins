import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should show login page initially', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that login page is shown
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByPlaceholder('EMP001 or email@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click submit without filling fields
    await page.getByRole('button', { name: /continue/i }).click();

    // Should show error
    await expect(page.getByText(/please enter user code or email and password/i)).toBeVisible();
  });

  test('should attempt login with user code', async ({ page }) => {
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

    // Fill in user code and password
    await page.getByPlaceholder('EMP001 or email@example.com').fill('EMP001');
    await page.getByPlaceholder('••••••••').fill('password123');

    // Click submit
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait a bit for the request to complete
    await page.waitForTimeout(2000);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/login-attempt.png', fullPage: true });

    // Check for error message or success
    const hasError = await page.getByText(/login failed/i).isVisible().catch(() => false);
    const hasSuccess = await page.getByText(/Dashboard/i).isVisible().catch(() => false);

    console.log('Console messages:', consoleMessages);
    console.log('Network errors:', networkErrors);
    console.log('Has error message:', hasError);
    console.log('Has success (Dashboard visible):', hasSuccess);

    // Log the current URL
    console.log('Current URL:', page.url());

    // Get any visible error messages
    const errorElements = await page.locator('[class*="error"], [class*="alert"]').all();
    for (const el of errorElements) {
      const text = await el.textContent();
      if (text) console.log('Error element found:', text);
    }
  });

  test('should attempt login with email', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Fill in email and password
    await page.getByPlaceholder('EMP001 or email@example.com').fill('emp001@lotb.local');
    await page.getByPlaceholder('••••••••').fill('password123');

    // Click submit
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait a bit for the request to complete
    await page.waitForTimeout(2000);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/email-login-attempt.png', fullPage: true });

    // Check for error message or success
    const hasError = await page.getByText(/login failed/i).isVisible().catch(() => false);
    const hasSuccess = await page.getByText(/Dashboard/i).isVisible().catch(() => false);

    console.log('Console messages:', consoleMessages);
    console.log('Has error message:', hasError);
    console.log('Has success (Dashboard visible):', hasSuccess);
  });

  test('should check Supabase connection', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Execute code to check Supabase client
    const supabaseCheck = await page.evaluate(() => {
      // Check if window has access to Supabase (through imports)
      return {
        hasSupabase: typeof (window as any).supabase !== 'undefined',
        environment: {
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'present' : 'missing',
        }
      };
    });

    console.log('Supabase check:', supabaseCheck);
  });
});
