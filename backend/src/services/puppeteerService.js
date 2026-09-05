/**
 * Puppeteer automation pipeline coordinator.
 */

import {
  launchBrowser,
  navigateToJob,
  handleAuth,
  startApplication,
  selectorExists,
  NEXT_BUTTON
} from './steps/common.js';

import { fillBasicInfo } from './steps/step1-basicInfo.js';
import { fillExperience } from './steps/step2-experience.js';
import { fillApplicationQuestions } from './steps/step3-questions.js';
import { fillVoluntaryDisclosures, fillSelfIdentification } from './steps/step4-disclosures.js';
import { reviewAndSubmit } from './steps/step5-review.js';

// Re-export all step modules for complete backward compatibility
export * from './steps/index.js';

/**
 * Runs the full end-to-end Workday automation pipeline
 */
export async function runFullAutomation(jobUrl, profile, options = {}) {
  const email = options.email || profile.personalInfo?.email || '';
  const password = options.password || 'Str0ng!Pass-->';
  const resumeFilePath = options.resumeFilePath || null;

  const { browser, page } = await launchBrowser(options);

  try {
    await navigateToJob(page, jobUrl);

    // Auth
    if (options.skipAuth !== true) {
      await handleAuth(page, email, password);
    }

    // Start Application
    if (options.skipStart !== true) {
      await startApplication(page);
    }

    // Step 1: Contact Information
    await page.waitForSelector('div[data-automation-id="contactInformationPage"]');
    await fillBasicInfo(page, profile);

    // Step 2: My Experience
    await page.waitForSelector('div[data-automation-id="myExperiencePage"]', { timeout: 0 });
    await fillExperience(page, profile, resumeFilePath);

    // Step 3: Application Questions (if present)
    if (await selectorExists(page, 'div[data-automation-id*="question"]', 3000)) {
      await fillApplicationQuestions(page, profile);
    }

    // Step 4: Voluntary Disclosures
    if (await selectorExists(page, 'div[data-automation-id="voluntaryDisclosuresPage"]', 3000)) {
      await fillVoluntaryDisclosures(page, profile);
    }

    // Step 4b: Self-Identification
    if (await selectorExists(page, 'div[data-automation-id="selfIdentificationPage"]', 3000)) {
      await fillSelfIdentification(page, profile);
    }

    // Step 5: Review & Confirmation
    const reviewResult = await reviewAndSubmit(page, options);

    console.log('✅ Full Workday application automation completed successfully');

    return {
      success: true,
      message: 'Application automation completed',
      stepsCompleted: ['contactInfo', 'experience', 'voluntaryDisclosures', 'selfIdentification', 'review'],
      review: reviewResult
    };
  } catch (error) {
    console.error('Automation error:', error);
    return {
      success: false,
      error: error.message,
      stepsCompleted: []
    };
  } finally {
    if (options.closeBrowser !== false) {
      await browser.close();
    }
  }
}

/**
 * Executes an isolated single step via Puppeteer
 */
export async function fillSingleStep(jobUrl, profile, stepName, options = {}) {
  const { browser, page } = await launchBrowser(options);

  try {
    await navigateToJob(page, jobUrl);

    switch (stepName.toLowerCase()) {
      case 'contact':
      case 'contactinfo':
      case 'step1':
      case 'my information':
        await fillBasicInfo(page, profile);
        break;
      case 'experience':
      case 'step2':
      case 'my experience':
        await fillExperience(page, profile, options.resumeFilePath);
        break;
      case 'questions':
      case 'step3':
      case 'application questions':
        await fillApplicationQuestions(page, profile);
        break;
      case 'voluntary':
      case 'voluntary disclosures':
      case 'step4':
        await fillVoluntaryDisclosures(page, profile);
        break;
      case 'selfidentify':
      case 'self-identification':
        await fillSelfIdentification(page, profile);
        break;
      case 'review':
      case 'step5':
        return await reviewAndSubmit(page, options);
      default:
        throw new Error(`Unknown step: ${stepName}`);
    }

    return { success: true, step: stepName, message: `Step "${stepName}" completed` };
  } catch (error) {
    return { success: false, step: stepName, error: error.message };
  } finally {
    if (options.closeBrowser !== false) {
      await browser.close();
    }
  }
}
