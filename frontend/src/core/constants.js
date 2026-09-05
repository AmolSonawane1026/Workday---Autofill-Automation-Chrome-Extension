import { CONFIG } from './config.js';

export const ACTIONS = {
  DETECT_PAGE: 'DETECT_PAGE',
  PAGE_DETECTED: 'PAGE_DETECTED',
  SCAN_FIELDS: 'SCAN_FIELDS',
  FIELDS_SCANNED: 'FIELDS_SCANNED',
  MAP_FIELDS: 'MAP_FIELDS',
  FIELDS_MAPPED: 'FIELDS_MAPPED',
  FILL_FIELDS: 'FILL_FIELDS',
  FIELDS_FILLED: 'FIELDS_FILLED',
  PARSE_RESUME_FILE: 'PARSE_RESUME_FILE',
  RESUME_PARSED: 'RESUME_PARSED',
  SAVE_PROFILE: 'SAVE_PROFILE',
  GET_PROFILE: 'GET_PROFILE',
  GENERATE_ANSWERS: 'GENERATE_ANSWERS',
  ANSWERS_GENERATED: 'ANSWERS_GENERATED',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS',
  AUTOFILL_STEP: 'AUTOFILL_STEP',
  GET_RESUME_FILE: 'GET_RESUME_FILE',
  SYNC_ASSISTANT_STATE: 'SYNC_ASSISTANT_STATE',
  SHOW_ASSISTANT: 'SHOW_ASSISTANT',
  HIDE_ASSISTANT: 'HIDE_ASSISTANT'
};

export const DEFAULT_SETTINGS = {
  geminiApiKey: '',
  hasApiKey: false,
  model: CONFIG.DEFAULT_MODEL || 'gemini-1.5-flash',
  backendUrl: CONFIG.API_BASE_URL || 'http://localhost:5000/api',
  useBackend: false,
  autoAdvanceSteps: false,
  highlightFilledFields: true,
  skipPrefilledFields: true,
  eeoDefaults: {
    gender: 'I choose not to self-identify',
    ethnicity: 'I choose not to self-identify',
    veteran: 'I am not a protected veteran',
    disability: 'I do not wish to answer'
  },
  workAuthDefaults: {
    authorizedInCountry: true,
    requiresSponsorship: false
  }
};
