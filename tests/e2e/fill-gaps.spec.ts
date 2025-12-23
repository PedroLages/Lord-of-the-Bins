import { test, expect, type Page } from '@playwright/test';

/**
 * Fill Gaps Feature E2E Tests
 *
 * Tests the auto-fill gaps feature with V2 scoring algorithm
 * Based on: docs/test-reports/TEST_REPORT_FILL_GAPS.md
 */

test.describe('Fill Gaps Feature', () => {
  // Helper function to login as Team Leader
  async function loginAsTeamLeader(page: Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill in credentials (using Natalia test account)
    await page.getByPlaceholder('EMP001 or your@email.com').fill('natalia@bol.com');
    await page.getByPlaceholder('••••••••').fill('12345');

    // Submit login
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for app to load
    await page.waitForTimeout(3000);

    // Verify we're logged in by checking for sidebar navigation or schedule table
    const hasSidebar = await page.getByRole('button', { name: /dashboard/i }).isVisible().catch(() => false);
    const hasSchedule = await page.getByText(/weekly assignment/i).isVisible().catch(() => false);
    const hasWelcome = await page.getByText(/welcome/i).isVisible().catch(() => false);

    if (!hasSidebar && !hasSchedule && !hasWelcome) {
      throw new Error('Login failed - dashboard not loaded');
    }
  }

  // Helper function to configure Task Requirements
  async function configureTaskRequirements(page: Page) {
    // Navigate to Settings
    await page.getByRole('button', { name: /^settings$/i }).click();
    await page.waitForTimeout(500);

    // Click on "Staffing Requirements" tab
    await page.getByRole('button', { name: /staffing requirements/i }).click();
    await page.waitForTimeout(500);

    // Find all number inputs in Task Staffing section
    const inputs = await page.locator('input[type="number"]').all();

    // Set some basic requirements (at least 2 for first few tasks)
    for (let i = 0; i < Math.min(5, inputs.length); i++) {
      await inputs[i].fill('2'); // Set requirement to 2 for first 5 tasks
    }

    // Click Save button
    const saveButton = page.getByRole('button', { name: /save changes/i }).first();
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      // Wait for save confirmation toast and data persistence
      await page.waitForTimeout(2000);
    }

    // Navigate back to Schedule
    await page.getByRole('button', { name: /^schedule$/i }).click();
    await page.waitForTimeout(1000); // Give time for Schedule view to load and state to refresh
  }

  // Helper function to navigate to Schedule view
  async function navigateToSchedule(page: Page) {
    // Click Schedule in sidebar (exact match to avoid ambiguity)
    await page.getByRole('button', { name: /^schedule$/i }).click();
    await page.waitForTimeout(500); // Wait for view transition
  }

  // Helper function to clear all assignments
  async function clearSchedule(page: Page) {
    // Click Clear button if available
    const clearButton = page.locator('button[title*="Clear"]').first();
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(500);
    }
  }

  // Helper function to click Fill Gaps button
  async function clickFillGaps(page: Page) {
    await page.getByRole('button', { name: /fill gaps/i }).click();
    await page.waitForTimeout(1000); // Wait for algorithm to run and preview to show
  }

  test.beforeEach(async ({ page }) => {
    await loginAsTeamLeader(page);
    await configureTaskRequirements(page);
    await navigateToSchedule(page);
  });

  test('Scenario 1: Empty Schedule Fill', async ({ page }) => {
    // Capture console messages for debugging
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[Fill Gaps]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Click Fill Gaps button
    await clickFillGaps(page);

    // Verify preview modal appears
    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check that stats are shown
    const statsText = await page.locator('[class*="stats"]').first().textContent();
    console.log('Stats:', statsText);

    // Verify cells were filled
    await expect(page.getByText(/filled cells/i)).toBeVisible();

    // Check console logs
    console.log('Fill Gaps Console Messages:', consoleMessages);
    expect(consoleMessages.some(msg => msg.includes('Fill Gaps'))).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'test-results/fill-gaps-empty-schedule.png', fullPage: true });
  });

  test('Scenario 2: Partial Schedule Fill', async ({ page }) => {
    // TODO: Manually assign some operators first
    // Then verify Fill Gaps only fills empty cells

    await clickFillGaps(page);

    // Verify preview modal
    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check that existing assignments are not in the preview
    // (This requires accessing the preview table data)

    await page.screenshot({ path: 'test-results/fill-gaps-partial-schedule.png', fullPage: true });
  });

  test('Scenario 3: Locked Assignment Respect', async ({ page }) => {
    // TODO: Create assignments and lock some cells
    // Then verify locked cells don't appear in Fill Gaps preview

    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Verify locked cells are not modified
    // (This requires checking the preview table for locked cell indicators)

    await page.screenshot({ path: 'test-results/fill-gaps-locked-respect.png', fullPage: true });
  });

  test('Scenario 6: Skill Mismatch Handling', async ({ page }) => {
    // Capture console for skill mismatch logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('No eligible tasks')) {
        consoleMessages.push(msg.text());
      }
    });

    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check for unfillable gaps section
    const unfillableSection = page.locator('text=Unfillable Gaps').first();
    if (await unfillableSection.isVisible()) {
      // Verify reasons are shown
      await expect(page.getByText(/no tasks match operator skills/i)).toBeVisible();
    }

    console.log('Skill mismatch console logs:', consoleMessages);

    await page.screenshot({ path: 'test-results/fill-gaps-skill-mismatch.png', fullPage: true });
  });

  test('Scenario 7: Soft Rule - Avoid Consecutive Same Task', async ({ page }) => {
    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Look for warning icons (⚠️) indicating broken soft rules
    const warningIcons = page.locator('text=⚠️');
    const warningCount = await warningIcons.count();

    console.log('Broken soft rules count:', warningCount);

    // Hover over warning icon to see tooltip
    if (warningCount > 0) {
      await warningIcons.first().hover();
      await page.waitForTimeout(500);

      // Check for soft rule tooltip
      await expect(page.getByText(/avoid-consecutive-same-task/i)).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/fill-gaps-soft-rule-consecutive.png', fullPage: true });
  });

  test('Scenario 11: Apply and Validate', async ({ page }) => {
    await clickFillGaps(page);

    // Wait for preview
    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check preview stats before applying
    const statsBeforeApply = await page.locator('[class*="stats"]').first().textContent();
    console.log('Stats before apply:', statsBeforeApply);

    // Click Apply Changes button
    await page.getByRole('button', { name: /apply changes/i }).click();

    // Wait for success toast
    await expect(page.getByText(/gaps filled/i)).toBeVisible({ timeout: 3000 });

    // Verify modal closes
    await expect(page.getByText(/fill gaps preview/i)).not.toBeVisible({ timeout: 2000 });

    // Check that schedule warnings panel updates (if any conflicts)
    const warningsPanel = page.locator('[class*="warnings"]').first();
    if (await warningsPanel.isVisible()) {
      console.log('Warnings after apply:', await warningsPanel.textContent());
    }

    await page.screenshot({ path: 'test-results/fill-gaps-after-apply.png', fullPage: true });
  });

  test('Scenario 12: Task Requirements Not Configured', async ({ page }) => {
    // TODO: Clear all task requirements in Settings
    // Then verify warning toast appears

    // Navigate to Settings → Configuration
    await page.getByRole('button', { name: /settings/i }).click();
    await page.waitForTimeout(500);

    // TODO: Clear Task Staffing requirements
    // (This requires implementing UI interaction with Settings page)

    // Navigate back to Schedule
    await navigateToSchedule(page);

    // Try to click Fill Gaps
    await clickFillGaps(page);

    // Verify warning toast
    await expect(page.getByText(/configure task staffing requirements/i)).toBeVisible({ timeout: 5000 });

    // Verify no preview modal shown
    await expect(page.getByText(/fill gaps preview/i)).not.toBeVisible();

    await page.screenshot({ path: 'test-results/fill-gaps-no-requirements.png', fullPage: true });
  });

  test('Performance: Algorithm Runtime', async ({ page }) => {
    // Measure Fill Gaps algorithm execution time
    const startTime = Date.now();

    await clickFillGaps(page);

    // Wait for preview to appear
    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    const endTime = Date.now();
    const runtime = endTime - startTime;

    console.log(`Fill Gaps algorithm runtime: ${runtime}ms`);

    // Verify runtime is under 1 second (1000ms)
    expect(runtime).toBeLessThan(1000);

    await page.screenshot({ path: 'test-results/fill-gaps-performance.png', fullPage: true });
  });

  test('Browser Console Validation', async ({ page }) => {
    // Capture all console messages
    const consoleMessages: { type: string; text: string }[] = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Verify no TypeScript or runtime errors
    const tsErrors = errors.filter(e => e.includes('TypeScript') || e.includes('Uncaught'));
    expect(tsErrors.length).toBe(0);

    // Verify Fill Gaps log messages appear
    const fillGapsLogs = consoleMessages.filter(msg => msg.text.includes('[Fill Gaps]'));
    expect(fillGapsLogs.length).toBeGreaterThan(0);

    console.log('Fill Gaps console logs:');
    fillGapsLogs.forEach(log => console.log(`  ${log.type}: ${log.text}`));

    console.log('All errors:', errors);
  });

  test('Edge Case: All Operators Lack Required Skills', async ({ page }) => {
    // TODO: Set up scenario where no operators have required skills
    // This requires modifying operator skills in Settings

    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check stats
    const stats = await page.locator('text=Filled Cells').textContent();
    expect(stats).toContain('0');

    // Verify unfillable gaps section
    await expect(page.getByText(/unfillable gaps/i)).toBeVisible();
    await expect(page.getByText(/no tasks match operator skills/i)).toBeVisible();

    await page.screenshot({ path: 'test-results/fill-gaps-no-skills.png', fullPage: true });
  });

  test('Edge Case: Single Operator, Single Task', async ({ page }) => {
    // TODO: Set up scenario with only one operator and one task
    // This should result in multiple soft rule violations

    await clickFillGaps(page);

    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Count warning icons (should be many)
    const warningIcons = page.locator('text=⚠️');
    const warningCount = await warningIcons.count();

    console.log('Soft rule violations (single op/task):', warningCount);
    expect(warningCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/fill-gaps-single-op-task.png', fullPage: true });
  });

  test('UI Validation: Preview Modal Structure', async ({ page }) => {
    await clickFillGaps(page);

    // Verify modal structure
    await expect(page.getByText(/fill gaps preview/i)).toBeVisible({ timeout: 5000 });

    // Check for required sections
    await expect(page.getByText(/statistics/i)).toBeVisible();
    await expect(page.getByText(/filled cells/i)).toBeVisible();
    await expect(page.getByText(/rules followed/i)).toBeVisible();

    // Check for action buttons
    await expect(page.getByRole('button', { name: /apply changes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Check for assignments table
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    await page.screenshot({ path: 'test-results/fill-gaps-modal-structure.png', fullPage: true });
  });
});
