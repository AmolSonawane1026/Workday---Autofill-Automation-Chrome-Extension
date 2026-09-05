/**
 * Common Puppeteer Utilities & Authentication Helpers for Workday Automation
 */

import puppeteer from 'puppeteer';

export const NEXT_BUTTON = 'button[data-automation-id="bottom-navigation-next-button"]';

export async function selectorExists(page, selector, timeout = 1000) {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch (error) {
    return false;
  }
  return true;
}

export async function withOptSelector(page, selector, callback, searchTimeout = 2000) {
  let el;
  try {
    await page.waitForSelector(selector, { timeout: searchTimeout });
    el = page.locator(selector);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.warn(`Selector not found within timeout limit: ${selector}`);
      return false;
    }
    throw err;
  }
  return await callback(el);
}

export async function launchBrowser(options = {}) {
  const browser = await puppeteer.launch({
    headless: options.headless !== undefined ? options.headless : false,
    defaultViewport: options.defaultViewport !== undefined ? options.defaultViewport : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(options.timeout || 15000);
  return { browser, page };
}

export async function navigateToJob(page, url) {
  console.log(`Navigating to Workday job URL: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2' });
}

export async function signIn(page, email, password) {
  console.log('Signing in...');
  await page.locator('button[data-automation-id="utilityButtonSignIn"]').click();
  await page.locator('input[data-automation-id="email"]').fill(email);
  await page.locator('input[data-automation-id="password"]').fill(password);
  await page.locator('button[data-automation-id="signInSubmitButton"]').click({ delay: 500 });
}

export async function createAccount(page, email, password) {
  console.log('Creating new account...');
  await page.locator('button[data-automation-id="createAccountLink"]').click();
  await page.locator('input[data-automation-id="email"]').fill(email);
  await page.locator('input[data-automation-id="password"]').fill(password);
  await page.locator('input[data-automation-id="verifyPassword"]').fill(password);

  const createAccountCheckbox = 'input[data-automation-id="createAccountCheckbox"]';
  if (await selectorExists(page, createAccountCheckbox)) {
    await page.click(createAccountCheckbox);
  }

  await page.locator('button[data-automation-id="createAccountSubmitButton"]').click();
}

export async function handleAuth(page, email, password) {
  await signIn(page, email, password);
  if (await selectorExists(page, 'div[data-automation-id="errorMessage"]')) {
    console.log('Account did not exist. Creating new account and signing in...');
    await createAccount(page, email, password);
    await signIn(page, email, password);
  }
}

export async function startApplication(page) {
  console.log('Starting Application...');
  await page.locator('a[data-automation-id="adventureButton"]').click();
  await page.locator('a[data-automation-id="adventureButton"]').click();
  await page.locator('a[data-automation-id="applyManually"]').click();
}

export function parseDateToMonthYear(dateStr) {
  if (!dateStr) return { month: '', year: '' };
  const str = String(dateStr).trim();

  // Already MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})$/);
  if (slashMatch) {
    return { month: slashMatch[1].padStart(2, '0'), year: slashMatch[2] };
  }

  // YYYY-MM-DD or YYYY-MM
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
  if (isoMatch) {
    return { month: isoMatch[2].padStart(2, '0'), year: isoMatch[1] };
  }

  // Month Name + Year
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };
  const monthNameMatch = str.match(/^([a-zA-Z]{3,9})\s+(\d{4})$/i);
  if (monthNameMatch) {
    const mKey = monthNameMatch[1].toLowerCase();
    if (monthMap[mKey]) {
      return { month: monthMap[mKey], year: monthNameMatch[2] };
    }
  }

  const yearOnly = str.match(/^(\d{4})$/);
  if (yearOnly) {
    return { month: '01', year: yearOnly[1] };
  }

  return { month: '', year: '' };
}
