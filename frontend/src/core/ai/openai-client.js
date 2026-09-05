import OpenAI from 'openai';
import { getDecryptedApiKey, getSettings } from '../security/storage.js';

/**
 * Make an OpenAI Chat Completion request with error resilience
 * @param {Array} messages 
 * @param {Object} [options] 
 * @returns {Promise<string>}
 */
export async function createChatCompletion(messages, options = {}) {
  const apiKey = options.apiKey || await getDecryptedApiKey();
  const settings = await getSettings();
  const model = options.model || settings.model || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please add your key in the Extension Settings.');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      response_format: options.responseFormat || { type: 'json_object' },
      temperature: options.temperature !== undefined ? options.temperature : 0.1,
      max_tokens: options.maxTokens || 4000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    if (error.status === 401 || (error.message && error.message.includes('401'))) {
      throw new Error('Unauthorized: Invalid OpenAI API Key. Please verify your key in Settings.');
    }
    if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
      throw new Error('OpenAI Rate limit reached or insufficient quota. Please check your OpenAI account.');
    }
    throw new Error(`AI Request Failed: ${error.message}`);
  }
}
