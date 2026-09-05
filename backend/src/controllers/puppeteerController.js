/**
 * Puppeteer Automation Controller
 * Exposes endpoints for browser-based Workday form automation using Puppeteer.
 * Mirrors the proven logic from Workday-Application-Automator reference repo.
 */

import {
  runFullAutomation,
  fillSingleStep,
  launchBrowser,
  navigateToJob,
  fillBasicInfo,
  fillExperience,
  fillVoluntaryDisclosures,
  fillSelfIdentification,
  handleAuth,
  startApplication
} from '../services/puppeteerService.js';

/**
 * POST /api/automation/run-full
 * Runs the full Workday application automation pipeline via Puppeteer.
 * Body: { jobUrl, profile, email, password, resumeFilePath, headless }
 */
export async function runFullPuppeteerAutomation(req, res) {
  try {
    const { jobUrl, profile, email, password, resumeFilePath, headless } = req.body;

    if (!jobUrl) {
      return res.status(400).json({ success: false, error: 'jobUrl is required' });
    }
    if (!profile || !profile.personalInfo) {
      return res.status(400).json({ success: false, error: 'profile with personalInfo is required' });
    }

    const result = await runFullAutomation(jobUrl, profile, {
      email: email || profile.personalInfo.email,
      password,
      resumeFilePath,
      headless: headless !== false ? headless : false,
      closeBrowser: true
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Puppeteer full automation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Puppeteer automation failed'
    });
  }
}

/**
 * POST /api/automation/fill-step
 * Fills a single application step via Puppeteer.
 * Body: { jobUrl, profile, stepName, resumeFilePath, headless }
 */
export async function fillStepWithPuppeteer(req, res) {
  try {
    const { jobUrl, profile, stepName, resumeFilePath, headless } = req.body;

    if (!jobUrl) {
      return res.status(400).json({ success: false, error: 'jobUrl is required' });
    }
    if (!profile) {
      return res.status(400).json({ success: false, error: 'profile is required' });
    }
    if (!stepName) {
      return res.status(400).json({ success: false, error: 'stepName is required' });
    }

    const result = await fillSingleStep(jobUrl, profile, stepName, {
      resumeFilePath,
      headless: headless !== false ? headless : false,
      closeBrowser: true
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Puppeteer step fill error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Puppeteer step fill failed'
    });
  }
}

/**
 * GET /api/automation/puppeteer-status
 * Returns Puppeteer availability and version info.
 */
export async function getPuppeteerStatus(req, res) {
  try {
    let version = 'unknown';
    try {
      const puppeteer = await import('puppeteer');
      // Try to get the version from the default export
      if (puppeteer.default?.executablePath) {
        version = 'installed';
      } else {
        version = 'installed';
      }
    } catch (e) {
      version = 'not installed';
    }

    return res.status(200).json({
      success: true,
      puppeteer: {
        available: version !== 'not installed',
        version
      },
      supportedSteps: [
        'My Information (Contact Info)',
        'My Experience (Work, Education, Skills, Resume, Links)',
        'Voluntary Disclosures (Gender, Ethnicity, Veteran)',
        'Self-Identification (Disability, Name, Date)'
      ]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
