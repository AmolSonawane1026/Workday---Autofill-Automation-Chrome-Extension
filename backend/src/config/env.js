import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-1.5-flash',
  clientUrl: process.env.CLIENT_URL || '*'
};
