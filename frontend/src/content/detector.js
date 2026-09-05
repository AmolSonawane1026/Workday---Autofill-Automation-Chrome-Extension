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
  const hasPasswordField = document.querySelector('input[type="password"]') !== null;
  const hasCreateAccountText = /create\s*account/i.test(bodyText);
  const hasSignInText = /sign\s*in|log\s*in/i.test(bodyText);
  const hasLegalNameSection = document.querySelector('[data-automation-id*="legalNameSection"]') !== null;
  const hasWorkExpSection = document.querySelector('[data-automation-id*="workExperience"]') !== null;

  // 1. Definite Auth Step (Create Account / Sign In)
  if ((hasPasswordField || hasCreateAccountText || hasSignInText) && !hasLegalNameSection && !hasWorkExpSection) {
    return { stepNumber: 0, name: 'Create Account / Sign In', isAuthStep: true };
  }

  // 2. Stepper / Progress Bar
  const activeStepElem = document.querySelector(
    '[data-automation-id="progressBarActiveStep"], [aria-current="step"], .current-step, [data-automation-id*="stepItemActive"]'
  );

  if (activeStepElem) {
    const text = activeStepElem.textContent.trim();
    return normalizeStepName(text);
  }

  // 3. Page Headings & Body Sections
  const lowerBody = bodyText.toLowerCase();
  if (lowerBody.includes('my information') || lowerBody.includes('contact information') || hasLegalNameSection) {
    return { stepNumber: 1, name: 'My Information', isAuthStep: false };
  }
  if (lowerBody.includes('my experience') || lowerBody.includes('work experience') || hasWorkExpSection) {
    return { stepNumber: 2, name: 'My Experience', isAuthStep: false };
  }
  if (lowerBody.includes('application questions') || lowerBody.includes('voluntary disclosures')) {
    return { stepNumber: 3, name: 'Application Questions', isAuthStep: false };
  }
  // Self-Identification page (from reference apply.js: selfIdentificationPage)
  const hasSelfIdPage = document.querySelector('[data-automation-id="selfIdentificationPage"]') !== null;
  if (hasSelfIdPage || lowerBody.includes('self-identification') || lowerBody.includes('self identification') || lowerBody.includes('disability status')) {
    return { stepNumber: 4, name: 'Self-Identification', isAuthStep: false };
  }
  if (lowerBody.includes('review and submit')) {
    return { stepNumber: 5, name: 'Review and Submit', isAuthStep: false };
  }

  // Default fallback
  if (hasPasswordField) {
    return { stepNumber: 0, name: 'Create Account / Sign In', isAuthStep: true };
  }

  return { stepNumber: 1, name: 'Application Form', isAuthStep: false };
}

function normalizeStepName(rawText) {
  const text = rawText.toLowerCase();
  if (text.includes('create account') || text.includes('sign in')) return { stepNumber: 0, name: 'Create Account / Sign In', isAuthStep: true };
  if (text.includes('information')) return { stepNumber: 1, name: 'My Information', isAuthStep: false };
  if (text.includes('experience')) return { stepNumber: 2, name: 'My Experience', isAuthStep: false };
  if (text.includes('question')) return { stepNumber: 3, name: 'Application Questions', isAuthStep: false };
  if (text.includes('disclosure') || text.includes('voluntary')) return { stepNumber: 4, name: 'Voluntary Disclosures', isAuthStep: false };
  if (text.includes('self-identify') || text.includes('self identify') || text.includes('identification') || text.includes('disability')) return { stepNumber: 4, name: 'Self-Identification', isAuthStep: false };
  if (text.includes('review')) return { stepNumber: 5, name: 'Review and Submit', isAuthStep: false };
  return { stepNumber: 1, name: rawText, isAuthStep: false };
}

export function getFormContainer() {
  return document.querySelector(
    '[data-automation-id="formContainer"], form, main, [role="main"], #mainContent, body'
  );
}
