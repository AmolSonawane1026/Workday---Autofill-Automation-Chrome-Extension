/**
 * Content script entry point and step router for Workday applications.
 */

import { isWorkdayPage, detectCurrentStep, detectCompany } from './detector.js';
import { extractFormFields } from './extractor.js';
import { fillFormFields } from './filler.js';
import { WorkdayObserver } from './observer.js';
import { ACTIONS } from '../core/constants.js';

import {
  handleStep1,
  handleStep2,
  handleStep3,
  handleStep4,
  handleStep5
} from './steps/index.js';

import { autoUploadResumeFile } from './filler/sections-filler.js';

let currentFields = [];
let workdayObserver = null;

// Lightweight status logger for autofill events
const overlayAssistant = {
  updateState: (state) => {
    if (state?.statusMessage) {
      console.log(`[Workday Assistant]: ${state.statusMessage}`);
    }
  },
  mount: () => {},
  unmount: () => {}
};

/**
 * Initialize content script on Workday portal
 */
function initialize() {
  if (!isWorkdayPage()) {
    return;
  }

  console.log('🤖 Workday AI Autofill Assistant content script loaded');

  // Initial Scan
  handleScanFields();

  // Initialize Mutation Observer for dynamic renders
  workdayObserver = new WorkdayObserver(() => {
    handleScanFields(true); // silent rescan
  }, 500);
  workdayObserver.start();

  // Listen for messages from Popup or Background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(handleMessage);
  }
}

/**
 * Scan form fields on current step
 */
function handleScanFields(silent = false) {
  const stepInfo = detectCurrentStep();
  const company = detectCompany();
  currentFields = extractFormFields();

  const filledCount = currentFields.filter(f => {
    if (f.type === 'checkbox' || f.type === 'radio') return Boolean(f.currentValue);
    return Boolean(f.currentValue && String(f.currentValue).trim().length > 0);
  }).length;

  if (overlayAssistant) {
    overlayAssistant.updateState({
      stepName: stepInfo.name,
      stepNumber: stepInfo.stepNumber,
      totalFields: currentFields.length,
      filledFields: filledCount,
      statusMessage: silent ? 'Synced' : `Found ${currentFields.length} fields`
    });
  }

  return {
    stepInfo,
    company,
    fields: currentFields.map(f => ({
      id: f.id,
      label: f.label,
      name: f.name,
      type: f.type,
      required: f.required,
      currentValue: f.currentValue,
      options: f.options,
      automationId: f.automationId
    }))
  };
}

/**
 * Trigger Autofill Router:
 * Delegates to the dedicated per-step handler based on detected step
 */
async function handleAutofillTrigger() {
  overlayAssistant.updateState({ isProcessing: true, statusMessage: 'Checking profile...' });

  try {
    // 1. Verify candidate profile exists
    const profileCheck = await sendToBackground({ action: ACTIONS.GET_PROFILE });
    if (!profileCheck?.success || !profileCheck?.profile) {
      overlayAssistant.updateState({
        isProcessing: false,
        statusMessage: 'No profile found. Please upload resume in extension popup.'
      });
      return {
        success: false,
        error: 'No profile found. Please upload a resume first.'
      };
    }

    const profile = profileCheck.profile;
    const stepInfo = detectCurrentStep();
    const stepNum = stepInfo.stepNumber;
    const stepName = (stepInfo.name || '').toLowerCase();

    console.log(`🤖 Detected Workday Step: #${stepNum} - "${stepInfo.name}"`);

    // =========================================================================
    // STEP 1: My Information
    // =========================================================================
    if (stepNum === 1 || stepName.includes('information') || stepName.includes('contact') || stepName.includes('start')) {
      return await handleStep1(profile, currentFields, sendToBackground, overlayAssistant);
    }

    // =========================================================================
    // STEP 2: My Experience & Education
    // =========================================================================
    if (stepNum === 2 || stepName.includes('experience') || stepName.includes('education') || stepName.includes('history')) {
      return await handleStep2(profile, currentFields, overlayAssistant);
    }

    // =========================================================================
    // STEP 3: Application Questions
    // =========================================================================
    if (stepNum === 3 || stepName.includes('question')) {
      currentFields = extractFormFields();
      return await handleStep3(profile, currentFields, sendToBackground, overlayAssistant);
    }

    // =========================================================================
    // STEP 4: Voluntary Disclosures & Self-Identification
    // =========================================================================
    if (stepNum === 4 || stepName.includes('disclosure') || stepName.includes('identification') || stepName.includes('voluntary')) {
      currentFields = extractFormFields();
      return await handleStep4(profile, currentFields, sendToBackground, overlayAssistant);
    }

    // =========================================================================
    // STEP 5: Review Screen
    // =========================================================================
    if (stepNum === 5 || stepName.includes('review') || stepName.includes('summary')) {
      currentFields = extractFormFields();
      return await handleStep5(currentFields, overlayAssistant);
    }

    // =========================================================================
    // FALLBACK: General dynamic mapping for non-standard steps
    // =========================================================================
    currentFields = extractFormFields();
    overlayAssistant.updateState({ statusMessage: 'Mapping fields...' });
    const response = await sendToBackground({
      action: ACTIONS.MAP_FIELDS,
      data: {
        fields: currentFields.map(f => ({
          id: f.id,
          label: f.label,
          name: f.name,
          type: f.type,
          required: f.required,
          currentValue: f.currentValue,
          options: f.options,
          automationId: f.automationId
        }))
      }
    });

    if (response?.success && response?.mappings) {
      const executableMappings = response.mappings.map(m => {
        const matchingField = currentFields.find(f => f.id === m.id || f.automationId === m.automationId);
        return {
          ...m,
          currentValue: matchingField?.currentValue,
          element: matchingField?.element,
          groupElements: matchingField?.groupElements
        };
      });

      const fillResult = await fillFormFields(executableMappings);
      overlayAssistant.updateState({
        isProcessing: false,
        statusMessage: `Filled ${fillResult.filledCount} fields.`
      });
      return {
        success: true,
        step: stepNum,
        stepName: stepInfo.name,
        filledCount: fillResult.filledCount,
        message: `Filled ${fillResult.filledCount} fields.`
      };
    } else {
      overlayAssistant.updateState({
        isProcessing: false,
        statusMessage: response?.error || 'No mappings generated.'
      });
      return {
        success: false,
        error: response?.error || 'No mappings generated.'
      };
    }

  } catch (error) {
    console.error('Autofill error:', error);
    overlayAssistant.updateState({
      isProcessing: false,
      statusMessage: `Error: ${error.message}`
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle incoming messages from popup or background
 */
function handleMessage(message, sender, sendResponse) {
  const { action, data } = message || {};

  if (action === ACTIONS.DETECT_PAGE) {
    const stepInfo = detectCurrentStep();
    const company = detectCompany();
    sendResponse({
      success: true,
      isWorkday: isWorkdayPage(),
      stepInfo,
      company
    });
    return true;
  }

  if (action === ACTIONS.SCAN_FIELDS) {
    const scanData = handleScanFields();
    sendResponse({
      success: true,
      ...scanData
    });
    return true;
  }

  if (action === ACTIONS.AUTOFILL_STEP || action === 'AUTOFILL_STEP' || action === 'AUTOFILL_FORM_STEP') {
    handleAutofillTrigger().then((res) => {
      const scanData = handleScanFields(true);
      sendResponse({
        success: res ? res.success !== false : true,
        ...scanData,
        ...res
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (action === ACTIONS.FILL_FIELDS) {
    autoUploadResumeFile().catch(() => {});
    const { mappings, options } = data || {};
    currentFields = extractFormFields();

    const executableMappings = (mappings || []).map(m => {
      const cleanMLbl = (m.label || '').toLowerCase().trim().replace(/\*$/, '').trim();
      const field = currentFields.find(f => {
        if (m.id && f.id === m.id) return true;
        if (m.automationId && f.automationId && f.automationId.toLowerCase() === m.automationId.toLowerCase()) return true;
        if (cleanMLbl && f.label) {
          const cleanFLbl = f.label.toLowerCase().trim().replace(/\*$/, '').trim();
          return cleanFLbl === cleanMLbl || cleanFLbl.includes(cleanMLbl) || cleanMLbl.includes(cleanFLbl);
        }
        return false;
      });
      return {
        ...m,
        element: field?.element || m.element,
        groupElements: field?.groupElements || m.groupElements
      };
    });

    fillFormFields(executableMappings, options).then(result => {
      handleScanFields(true);
      sendResponse({ success: true, ...result });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });

    return true;
  }

  return false;
}

function sendToBackground(msg) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || '';
            if (err.includes('context invalidated')) {
              resolve({ success: false, error: 'Extension updated. Please refresh page to reconnect.' });
            } else {
              resolve({ success: false, error: err });
            }
          } else {
            resolve(res || { success: false, error: 'Empty background response' });
          }
        });
      } else {
        resolve({ success: false, error: 'Extension environment unavailable.' });
      }
    } catch (e) {
      resolve({ success: false, error: 'Extension environment unavailable.' });
    }
  });
}

// Auto-run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
