import { encryptSecret, decryptSecret } from './encryption.js';
import { DEFAULT_SETTINGS } from '../constants.js';

const STORAGE_KEYS = {
  PROFILE: 'workday_candidate_profile',
  SETTINGS: 'workday_assistant_settings',
  ENCRYPTED_KEY: 'workday_encrypted_gemini_key',
  RESUME_FILE: 'workday_raw_resume_file'
};

const isExtension = typeof chrome !== 'undefined' && chrome.storage?.local;

export async function getStorageItem(key) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : null);
      });
    });
  }
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setStorageItem(key, value) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage error:', e);
  }
}

export async function removeStorageItem(key) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => resolve());
    });
  }
  localStorage.removeItem(key);
}

export async function saveProfile(profile) {
  await setStorageItem(STORAGE_KEYS.PROFILE, {
    ...profile,
    lastUpdated: new Date().toISOString()
  });
}

export async function getProfile() {
  const profile = await getStorageItem(STORAGE_KEYS.PROFILE);
  if (!profile) return null;

  // Auto-normalize education if institution was bundled into degree
  if (profile.education && Array.isArray(profile.education)) {
    const validRawEdu = profile.education.filter(edu => {
      if (!edu) return false;
      const deg = String(edu.degree || '').trim();
      const inst = String(edu.institution || edu.school || '').trim();
      return (deg.length >= 2 && !/^\d+[\.\)]?$/.test(deg)) || (inst.length >= 2 && !/^\d+[\.\)]?$/.test(inst));
    });

    profile.education = validRawEdu.map(edu => {
      let degree = String(edu.degree || '').trim();
      let institution = String(edu.institution || edu.school || '').trim();
      let fieldOfStudy = String(edu.fieldOfStudy || edu.field_of_study || '').trim();

      if (!institution && degree) {
        const doubleSpaceParts = degree.split(/\s{2,}/);
        if (doubleSpaceParts.length >= 2) {
          degree = doubleSpaceParts[0].trim();
          institution = doubleSpaceParts.slice(1).join(' ').trim();
        } else {
          const parenMatch = degree.match(/^(.*?\))\s+([A-Z][A-Za-z0-9\s.,&'-]+)$/);
          if (parenMatch) {
            degree = parenMatch[1].trim();
            institution = parenMatch[2].trim();
          } else {
            const instMatch = degree.match(/^(.*?)(?:\s+[-–—|,\s]\s*|\s+)([A-Z][a-zA-Z0-9\s.,&'-]*(?:College|University|Institute|School|Academy|Vidya|Campus|Co\b).*)$/i);
            if (instMatch && instMatch[1].trim() && instMatch[2].trim()) {
              degree = instMatch[1].trim();
              institution = instMatch[2].trim();
            }
          }
        }
      }

      if (institution.endsWith(' Co') || institution.endsWith(' Co.')) {
        institution = institution.replace(/\s+Co\.?$/, ' College');
      }

      if (!fieldOfStudy && degree) {
        const d = degree.toLowerCase();
        if (d.includes('bca') || d.includes('mca') || d.includes('computer application')) {
          fieldOfStudy = 'Computer Applications';
        } else if (d.includes('computer') || d.includes('software') || d.includes('it')) {
          fieldOfStudy = 'Computer Science';
        } else if (d.includes('commerce') || d.includes('b.com')) {
          fieldOfStudy = 'Commerce';
        } else if (d.includes('business') || d.includes('mba')) {
          fieldOfStudy = 'Business Administration';
        } else {
          fieldOfStudy = 'Computer Applications';
        }
      }

      return {
        ...edu,
        degree,
        institution,
        school: institution,
        fieldOfStudy
      };
    });
  }

  // Auto-normalize work experience dates
  const exps = profile.workExperience || profile.experience;
  if (exps && Array.isArray(exps)) {
    const validExps = exps.filter(e => {
      if (!e) return false;
      const title = String(e.jobTitle || e.jobtitle || e.title || '').trim();
      const comp = String(e.company || e.employer || '').trim();
      return (title.length >= 2 && !/^\d+[\.\)]?$/.test(title)) || (comp.length >= 2 && !/^\d+[\.\)]?$/.test(comp));
    });

    const seenExp = new Set();
    const dedupedExps = validExps.filter(e => {
      const key = `${(e.company || '').toLowerCase().trim()}|${(e.jobTitle || '').toLowerCase().trim()}`;
      if (seenExp.has(key)) return false;
      seenExp.add(key);
      return true;
    });

    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    const parseParts = (dStr) => {
      if (!dStr) return { month: '', year: '' };
      const s = String(dStr).trim();
      const mMatch = s.match(/^([a-zA-Z]{3,9})\.?\s+(\d{4})$/i);
      if (mMatch && monthMap[mMatch[1].toLowerCase().replace('.', '')]) {
        return { month: monthMap[mMatch[1].toLowerCase().replace('.', '')], year: mMatch[2] };
      }
      const slashMatch = s.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})$/);
      if (slashMatch) return { month: slashMatch[1].padStart(2, '0'), year: slashMatch[2] };
      const yearOnly = s.match(/\b(19\d{2}|20\d{2})\b/);
      return { month: '', year: yearOnly ? yearOnly[1] : '' };
    };

    const normalizedExps = dedupedExps.map(e => {
      const sp = parseParts(e.startDate || e.start_date);
      const ep = parseParts(e.endDate || e.end_date);
      return {
        ...e,
        startDateMonth: e.startDateMonth || sp.month,
        startDateYear: e.startDateYear || sp.year,
        endDateMonth: e.endDateMonth || ep.month,
        endDateYear: e.endDateYear || ep.year
      };
    });
    profile.workExperience = normalizedExps;
    profile.experience = normalizedExps;
  }

  return profile;
}

export async function clearProfile() {
  await removeStorageItem(STORAGE_KEYS.PROFILE);
  await removeStorageItem(STORAGE_KEYS.RESUME_FILE);
}

export async function saveResumeFile(fileData) {
  await setStorageItem(STORAGE_KEYS.RESUME_FILE, fileData);
}

export async function getResumeFile() {
  return await getStorageItem(STORAGE_KEYS.RESUME_FILE);
}

export async function saveSettings(settings) {
  await setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}

export async function getSettings() {
  const settings = await getStorageItem(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveEncryptedApiKey(rawKey) {
  if (!rawKey) {
    await removeStorageItem(STORAGE_KEYS.ENCRYPTED_KEY);
    return;
  }
  const encrypted = await encryptSecret(rawKey);
  await setStorageItem(STORAGE_KEYS.ENCRYPTED_KEY, encrypted);
}

export async function getDecryptedApiKey() {
  const encrypted = await getStorageItem(STORAGE_KEYS.ENCRYPTED_KEY);
  if (!encrypted) {
    // Check if backend provides key via health check
    try {
      const res = await fetch('http://localhost:5000/health');
      if (res.ok) {
        const json = await res.json();
        if (json.aiConfigured) return 'BACKEND_MANAGED_KEY';
      }
    } catch {}
    return null;
  }
  try {
    return await decryptSecret(encrypted);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

export async function hasApiKey() {
  const key = await getDecryptedApiKey();
  return Boolean(key);
}

export async function clearAllUserData() {
  await removeStorageItem(STORAGE_KEYS.PROFILE);
  await removeStorageItem(STORAGE_KEYS.SETTINGS);
  await removeStorageItem(STORAGE_KEYS.ENCRYPTED_KEY);
  await removeStorageItem(STORAGE_KEYS.RESUME_FILE);
}

export const clearAllData = clearAllUserData;
