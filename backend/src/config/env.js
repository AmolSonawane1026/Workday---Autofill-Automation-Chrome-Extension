import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-1.5-flash',
  clientUrl: process.env.CLIENT_URL || '*',
  pythonServerUrl: process.env.PYTHON_SERVER_URL || 'http://127.0.0.1:8000',
  isProduction: process.env.NODE_ENV === 'production'
};

export default config;
