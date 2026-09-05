/**
 * Workday Puppeteer Automation - Step 4: Voluntary Disclosures & Self-Identification
 */

import { withOptSelector, NEXT_BUTTON } from './common.js';

export async function fillVoluntaryDisclosures(page, profile) {
  console.log('Filling voluntary disclosures (Step 4)...');
  const eeo = profile.eeoDefaults || {};

  // Gender
  await withOptSelector(
    page,
    'button[data-automation-id="gender"]',
    async (el) => {
      await el.click();
      await page.keyboard.type(eeo.gender || 'I choose not to self-identify', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  await new Promise(r => setTimeout(r, 200));

  // Hispanic or Latino
  await withOptSelector(
    page,
    'button[data-automation-id="hispanicOrLatino"]',
    async (el) => {
      await el.click();
      await page.keyboard.type(eeo.hispanicOrLatino || 'No', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  // Ethnicity
  await withOptSelector(
    page,
    'button[data-automation-id="ethnicityDropdown"]',
    async (el) => {
      await el.click();
      await page.keyboard.type(eeo.ethnicity || 'I choose not to self-identify', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  await new Promise(r => setTimeout(r, 200));

  // Veteran Status
  await withOptSelector(
    page,
    'button[data-automation-id="veteranStatus"]',
    async (el) => {
      await el.click();
      await page.keyboard.type(eeo.veteran || 'I am not a protected veteran', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  // Agreement Checkbox
  await withOptSelector(
    page,
    'input[data-automation-id="agreementCheckbox"]',
    async (el) => el.click()
  );

  await withOptSelector(page, NEXT_BUTTON, async (el) => el.click());
}

export async function fillSelfIdentification(page, profile) {
  console.log('Filling self-identification (Step 4)...');
  const p = profile.personalInfo || {};
  const fullName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
  const disability = profile.eeoDefaults?.disability || 'abstain';

  // Full Name
  await withOptSelector(
    page,
    'input[data-automation-id="name"]',
    async (el) => el.fill(fullName)
  );

  // Birth Date - Click today
  await withOptSelector(
    page,
    'div[data-automation-id="dateIcon"]',
    async (el) => el.click()
  );

  await withOptSelector(
    page,
    'button[data-automation-id="datePickerSelectedToday"]',
    async (el) => el.click()
  );

  // Disability Status
  if (disability === 'yes') {
    await withOptSelector(
      page,
      'input[id="64cbff5f364f10000ae7a421cf210000"]',
      async (el) => el.click()
    );
  } else if (disability === 'no') {
    await withOptSelector(
      page,
      'input[id="64cbff5f364f10000aeec521b4ec0000"]',
      async (el) => el.click()
    );
  } else {
    // abstain
    await withOptSelector(
      page,
      'input[id="64cbff5f364f10000af3af293a050000"]',
      async (el) => el.click()
    );
  }

  await page.locator(NEXT_BUTTON).click();
}
