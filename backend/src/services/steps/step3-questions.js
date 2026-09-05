/**
 * Workday Puppeteer Automation - Step 3: Application Questions
 */

import { withOptSelector, selectorExists, NEXT_BUTTON } from './common.js';

export async function fillApplicationQuestions(page, profile) {
  console.log('Filling application questions (Step 3)...');
  const auth = profile.workAuthorization || {};

  // 1. Work authorization radio (default to Yes)
  const authVal = auth.authorizedInTargetCountry !== false ? '1' : '2';
  if (await selectorExists(page, 'div[data-automation-id*="workAuth"]')) {
    await withOptSelector(
      page,
      `div[data-automation-id*="workAuth"] input[value="${authVal}"]`,
      (el) => el.click()
    );
  }

  // 2. Visa sponsorship radio (default to No)
  const sponsorVal = auth.requiresSponsorship === true ? '1' : '2';
  if (await selectorExists(page, 'div[data-automation-id*="sponsorship"]')) {
    await withOptSelector(
      page,
      `div[data-automation-id*="sponsorship"] input[value="${sponsorVal}"]`,
      (el) => el.click()
    );
  }

  // 3. Prior employment radio (default to No)
  if (await selectorExists(page, 'div[data-automation-id*="priorEmployment"]')) {
    await withOptSelector(
      page,
      'div[data-automation-id*="priorEmployment"] input[value="2"]',
      (el) => el.click()
    );
  }

  // Next
  if (await selectorExists(page, NEXT_BUTTON)) {
    await page.locator(NEXT_BUTTON).click();
  }
}
