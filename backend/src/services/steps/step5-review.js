/**
 * Workday Puppeteer Automation - Step 5: Review & Submission Safety Check
 */

import { selectorExists } from './common.js';

export async function reviewAndSubmit(page, options = {}) {
  console.log('Reviewing application (Step 5)...');
  const SUBMIT_BUTTON = 'button[data-automation-id="bottom-navigation-submit-button"], button[data-automation-id="submit-button"]';

  const hasSubmit = await selectorExists(page, SUBMIT_BUTTON, 3000);

  // Safety guard: Must require explicit user confirmation before final submission
  if (options.autoSubmit === true && hasSubmit) {
    console.log('⚠️ Explicit confirmation flag detected. Submitting application...');
    await page.locator(SUBMIT_BUTTON).click();
    return {
      reviewed: true,
      submitted: true,
      message: 'Application successfully submitted.'
    };
  }

  console.log('🛑 Final review reached. Submission halted awaiting user confirmation.');
  return {
    reviewed: true,
    submitted: false,
    requiresUserConfirmation: true,
    message: 'Application review reached. Awaiting explicit user confirmation before final submission.'
  };
}
