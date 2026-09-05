/**
 * Workday Puppeteer Automation - Step 1: Contact Information (Basic Info)
 */

import { withOptSelector, NEXT_BUTTON } from './common.js';

export async function fillBasicInfo(page, profile) {
  console.log('Filling basic info (Step 1)...');
  const p = profile.personalInfo || {};
  const addr = p.address || {};

  // Previous Worker question (select No)
  await withOptSelector(
    page,
    'div[data-automation-id="previousWorker"] input[id="2"]',
    (el) => el.click(),
    10000
  );

  // First Name
  await withOptSelector(
    page,
    'input[data-automation-id="legalNameSection_firstName"]',
    (el) => el.fill(p.firstName || '')
  );

  // Last Name
  await withOptSelector(
    page,
    'input[data-automation-id="legalNameSection_lastName"]',
    (el) => el.fill(p.lastName || '')
  );

  // Suffix (if available)
  if (p.suffix) {
    await withOptSelector(
      page,
      'button[data-automation-id="legalNameSection_social"]',
      async (el) => {
        await el.click();
        await page.keyboard.type(p.suffix, { delay: 50 });
        await page.keyboard.press('Enter');
      }
    );
  }

  // Address Line 1
  await withOptSelector(
    page,
    'input[data-automation-id="addressSection_addressLine1"]',
    (el) => el.fill(addr.street || `${addr.city || ''}, ${addr.state || ''}`.trim())
  );

  // City
  await withOptSelector(
    page,
    'input[data-automation-id="addressSection_city"]',
    (el) => el.fill(addr.city || '')
  );

  // State / Region
  await withOptSelector(
    page,
    'button[data-automation-id="addressSection_countryRegion"]',
    async (el) => {
      await el.click();
      await page.keyboard.type(addr.state || '', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  // Postal Code
  await withOptSelector(
    page,
    'input[data-automation-id="addressSection_postalCode"]',
    (el) => el.fill(addr.postalCode || '')
  );

  // Phone Device Type
  await withOptSelector(
    page,
    'button[data-automation-id="phone-device-type"]',
    async (el) => {
      await el.click();
      await page.keyboard.type('Mobile', { delay: 100 });
      await page.keyboard.press('Enter');
    }
  );

  // Clean phone number (strip country code)
  let cleanPhone = (p.phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2);
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
    cleanPhone = cleanPhone.slice(1);
  }

  // Phone Number
  await withOptSelector(
    page,
    'input[data-automation-id="phone-number"]',
    (el) => el.fill(cleanPhone)
  );

  await page.locator(NEXT_BUTTON).click();
}
