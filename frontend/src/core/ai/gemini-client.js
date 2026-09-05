import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDecryptedApiKey, getSettings } from '../security/storage.js';

export async function generateWithGemini(prompt, options = {}) {
  const apiKey = options.apiKey || await getDecryptedApiKey();
  const settings = await getSettings();
  const modelName = options.model || settings.model || 'gemini-1.5-flash';

  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please add your key in Settings.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: options.jsonOutput !== false 
        ? { responseMimeType: 'application/json', temperature: 0.1 } 
        : { temperature: 0.1 }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    if (error.message?.includes('API_KEY_INVALID') || error.status === 400) {
      throw new Error('Invalid Google Gemini API Key. Please verify your key in Settings.');
    }
    throw new Error(`AI Request Failed: ${error.message}`);
  }
}
