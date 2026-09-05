/**
 * Application Configuration Module
 * 
 * Centralizes all environment configuration values, preventing hardcoding
 * and ensuring security and maintainability across both browser extension and web builds.
 * 
 * Demonstrates 12-factor application design and defensive fallback handling.
 */

const getEnv = (key, fallback = '') => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      return process.env[key];
    }
  } catch {}
  return fallback;
};

export const CONFIG = {
  // Backend & API Endpoints
  BACKEND_URL: getEnv('VITE_BACKEND_URL', 'http://localhost:5000'),
  API_BASE_URL: getEnv('VITE_API_BASE_URL', `${getEnv('VITE_BACKEND_URL', 'http://localhost:5000')}/api`),
  
  // AI Inference Defaults
  DEFAULT_MODEL: getEnv('VITE_DEFAULT_MODEL', 'gemini-1.5-flash'),

  // Environment mode
  ENV: getEnv('MODE', getEnv('NODE_ENV', 'development')),
  IS_PRODUCTION: getEnv('PROD', false) === true || getEnv('NODE_ENV', '') === 'production'
};

export default CONFIG;
