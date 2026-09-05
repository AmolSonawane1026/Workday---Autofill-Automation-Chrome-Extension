import { ACTIONS } from '../core/constants.js';
import { getProfile, saveProfile, getSettings, saveSettings, getResumeFile } from '../core/security/storage.js';
import { mapFormFields } from '../core/ai/field-mapper.js';
import { parseResumeWithAI } from '../core/ai/resume-parser.js';
import { answerApplicationQuestions } from '../core/ai/question-answerer.js';

console.log('Workday Background Service Worker initialized.');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message || {};

  handleAction(action, data, sender)
    .then((response) => sendResponse({ success: true, ...response }))
    .catch((error) => {
      console.error(`Error in Service Worker for action ${action}:`, error);
      sendResponse({ success: false, error: error.message || 'Unknown background error' });
    });

  return true; // async response
});

async function handleAction(action, data, sender) {
  switch (action) {
    case ACTIONS.GET_RESUME_FILE: {
      const resumeFile = await getResumeFile();
      return { resumeFile };
    }

    case ACTIONS.GET_PROFILE: {
      const profile = await getProfile();
      return { profile };
    }

    case ACTIONS.SAVE_PROFILE: {
      await saveProfile(data.profile);
      return { message: 'Profile saved successfully' };
    }

    case ACTIONS.GET_SETTINGS: {
      const settings = await getSettings();
      return { settings };
    }

    case ACTIONS.SAVE_SETTINGS: {
      await saveSettings(data.settings);
      return { message: 'Settings updated' };
    }

    case ACTIONS.PARSE_RESUME_FILE: {
      const { text, options } = data;
      const profile = await parseResumeWithAI(text, options);
      await saveProfile(profile);
      return { profile };
    }

    case ACTIONS.MAP_FIELDS: {
      const { fields } = data;
      const profile = await getProfile();
      if (!profile) {
        throw new Error('No candidate resume profile found. Please upload your resume in the extension popup.');
      }
      const mappings = await mapFormFields(fields, profile);
      // Return both mappings AND profile so content script can use profile.skills for the skills multiselect
      return { mappings, profile };
    }

    case ACTIONS.GENERATE_ANSWERS: {
      const { questions } = data;
      const profile = await getProfile();
      if (!profile) {
        throw new Error('No candidate profile found.');
      }
      const answers = await answerApplicationQuestions(questions, profile);
      return { answers };
    }

    default:
      return { message: 'Action acknowledged' };
  }
}
