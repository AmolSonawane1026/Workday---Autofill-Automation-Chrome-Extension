/**
 * Workday Page & Step Detector
 * Identifies Workday platform instances, active application steps, and form containers
 */

export function isWorkdayPage() {
  const url = window.location.href.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  
  return host.includes('myworkdayjobs.com') ||
         host.includes('myworkday.com') ||
         host.includes('workday.com') ||
         host.includes('localhost') ||
         document.querySelector('[data-automation-id]') !== null;
}

export function detectCompany() {
  const host = window.location.hostname.toLowerCase();
  
  // Extract company subdomain (e.g. target.wd5.myworkdayjobs.com -> Target)
  const parts = host.split('.');
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost' && !parts[0].includes('workday')) {
    const raw = parts[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  if (host.includes('nvidia')) return 'NVIDIA';
  if (host.includes('target')) return 'Target';
  
  const title = document.title;
  if (title.includes('NVIDIA')) return 'NVIDIA';
  if (title.includes('Target')) return 'Target';
  
  return 'Workday';
}

export function detectCurrentStep() {
  const bodyText = document.body ? document.body.innerText : '';
  const lowerBody = bodyText.toLowerCase();
  const hasPasswordField = document.querySelector('input[type="password"]') !== null;
  const hasAuthContainer = document.querySelector('[data-automation-id="signInPage"], [data-automation-id="createAccountPage"], form[data-automation-id*="login"], form[data-automation-id*="signin"]') !== null;
  const hasLegalNameSection = document.querySelector('[data-automation-id*="legalNameSection"]') !== null;
  const hasWorkExpSection = document.querySelector('[data-automation-id*="workExperience"]') !== null;

  // 1. Stepper / Progress Bar (Highest Priority for active application workflows)
  const activeStepElem = document.querySelector(
    '[data-automation-id="progressBarActiveStep"], [aria-current="step"], [aria-current="page"], .current-step, [data-automation-id*="stepItemActive"], [data-automation-id*="activeStep"]'
  );

  if (activeStepElem) {
    const text = activeStepElem.textContent.trim();
    if (text) {
      return normalizeStepName(text);
    }
  }

  // 2. Main Page Headings / Titles
  const mainHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [data-automation-id*="pageHeader"], [data-automation-id*="stepHeader"]'));
  for (const h of mainHeadings) {
    const hText = (h.textContent || '').trim().toLowerCase();
    if (hText.includes('voluntary disclosure') || hText.includes('voluntary disclosures')) {
      return { stepNumber: 4, name: 'Voluntary Disclosures', isAuthStep: false };
    }
    if (hText.includes('self-identification') || hText.includes('self identification') || hText.includes('disability status')) {
      return { stepNumber: 4, name: 'Self-Identification', isAuthStep: false };
    }
    if (hText.includes('application question')) {
      return { stepNumber: 3, name: 'Application Questions', isAuthStep: false };
    }
    if (hText.includes('my experience') || hText.includes('work experience')) {
      return { stepNumber: 2, name: 'My Experience', isAuthStep: false };
    }
    if (hText.includes('my information') || hText.includes('contact information')) {
      return { stepNumber: 1, name: 'My Information', isAuthStep: false };
    }
    if (hText.includes('review and submit') || hText.includes('review')) {
      return { stepNumber: 5, name: 'Review and Submit', isAuthStep: false };
    }
  }

  // 3. Body Content & Section Signatures
  if (lowerBody.includes('voluntary disclosures') || lowerBody.includes('voluntary disclosure')) {
    return { stepNumber: 4, name: 'Voluntary Disclosures', isAuthStep: false };
  }
  const hasSelfIdPage = document.querySelector('[data-automation-id="selfIdentificationPage"]') !== null;
  if (hasSelfIdPage || lowerBody.includes('self-identification') || lowerBody.includes('self identification') || lowerBody.includes('disability status')) {
    return { stepNumber: 4, name: 'Self-Identification', isAuthStep: false };
  }
  if (lowerBody.includes('application questions') || lowerBody.includes('application question')) {
    return { stepNumber: 3, name: 'Application Questions', isAuthStep: false };
  }
  if (lowerBody.includes('my experience') || lowerBody.includes('work experience') || hasWorkExpSection) {
    return { stepNumber: 2, name: 'My Experience', isAuthStep: false };
  }
  if (lowerBody.includes('my information') || lowerBody.includes('contact information') || hasLegalNameSection) {
    return { stepNumber: 1, name: 'My Information', isAuthStep: false };
  }
  if (lowerBody.includes('review and submit')) {
    return { stepNumber: 5, name: 'Review and Submit', isAuthStep: false };
  }

  // 4. Definite Auth Step (Only if password field or dedicated login container is present without form inputs)
  if ((hasPasswordField || hasAuthContainer) && !hasLegalNameSection && !hasWorkExpSection) {
    return { stepNumber: 0, name: 'Create Account / Sign In', isAuthStep: true };
  }

  return { stepNumber: 1, name: 'Application Form', isAuthStep: false };
}

function normalizeStepName(rawText) {
  const text = rawText.toLowerCase();
  if (text.includes('disclosure') || text.includes('voluntary')) return { stepNumber: 4, name: 'Voluntary Disclosures', isAuthStep: false };
  if (text.includes('self-identify') || text.includes('self identify') || text.includes('identification') || text.includes('disability')) return { stepNumber: 4, name: 'Self-Identification', isAuthStep: false };
  if (text.includes('question')) return { stepNumber: 3, name: 'Application Questions', isAuthStep: false };
  if (text.includes('experience') || text.includes('education') || text.includes('history')) return { stepNumber: 2, name: 'My Experience', isAuthStep: false };
  if (text.includes('information') || text.includes('contact')) return { stepNumber: 1, name: 'My Information', isAuthStep: false };
  if (text.includes('review') || text.includes('summary')) return { stepNumber: 5, name: 'Review and Submit', isAuthStep: false };
  if (text.includes('create account') || text.includes('sign in') || text.includes('log in')) return { stepNumber: 0, name: 'Create Account / Sign In', isAuthStep: true };
  return { stepNumber: 1, name: rawText, isAuthStep: false };
}

export function getFormContainer() {
  return document.querySelector(
    '[data-automation-id="formContainer"], form, main, [role="main"], #mainContent, body'
  );
}
