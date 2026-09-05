import { mapFieldsWithAI, answerQuestionsWithAI } from '../services/aiService.js';
import { sendSecureError } from '../utils/securityErrorHandler.js';

export async function mapFormFields(req, res) {
  try {
    const { formFields, resumeData, model } = req.body;
    const apiKey = req.headers['x-gemini-key'] || req.headers['x-openai-key'] || req.body.apiKey;

    if (!Array.isArray(formFields)) {
      return res.status(400).json({ success: false, error: 'formFields array is required' });
    }
    if (!resumeData) {
      return res.status(400).json({ success: false, error: 'resumeData is required' });
    }

    const mappings = await mapFieldsWithAI(formFields, resumeData, apiKey, model || 'gemini-1.5-flash');

    return res.status(200).json({
      success: true,
      data: { mappings }
    });
  } catch (error) {
    return sendSecureError(res, error, 'Failed to map form fields');
  }
}

export async function answerQuestions(req, res) {
  try {
    const { questions, resumeData, model } = req.body;
    const apiKey = req.headers['x-gemini-key'] || req.headers['x-openai-key'] || req.body.apiKey;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'questions array is required' });
    }
    if (!resumeData) {
      return res.status(400).json({ success: false, error: 'resumeData is required' });
    }

    const answers = await answerQuestionsWithAI(questions, resumeData, apiKey, model || 'gemini-1.5-flash');

    return res.status(200).json({
      success: true,
      data: { answers }
    });
  } catch (error) {
    return sendSecureError(res, error, 'Failed to generate answers');
  }
}

export async function inferLocation(req, res) {
  try {
    const { location } = req.body;
    const apiKey = req.headers['x-gemini-key'] || req.headers['x-openai-key'] || req.body.apiKey;

    if (!location) {
      return res.status(400).json({ success: false, error: 'Location query is required' });
    }

    // Connect to Python LangGraph + ChromaDB Vector Store service on port 8000
    try {
      const pyRes = await fetch('http://localhost:8000/api/ai/infer-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, api_key: apiKey })
      });
      if (pyRes.ok) {
        const json = await pyRes.json();
        return res.status(200).json(json);
      }
    } catch (pyErr) {
      console.debug('Python LangGraph geo endpoint notice:', pyErr.message);
    }

    // Fallback if Python service unavailable
    return res.status(200).json({
      success: true,
      location,
      data: { city: location, state: '', country: '', countryPhoneCode: '', dialCode: '', postalCode: '', addressLine1: location }
    });
  } catch (error) {
    return sendSecureError(res, error, 'Failed to infer location');
  }
}

