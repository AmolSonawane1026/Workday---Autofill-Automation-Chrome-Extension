import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import apiRoutes from './routes/api.js';
import { sendSecureError } from './utils/securityErrorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.clientUrl || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key', 'x-openai-key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Workday AI Automation Backend',
    version: '1.0.0',
    aiEngine: 'Google Gemini',
    hasApiKey: Boolean(config.geminiApiKey && config.geminiApiKey.length > 5),
    timestamp: new Date().toISOString()
  });
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  return sendSecureError(res, err, 'Internal Server Error');
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.originalUrl} not found`
  });
});

import { startPythonBackend } from './services/pythonSupervisor.js';

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, async () => {
    console.log(` Workday AI Backend running on http://localhost:${config.port}`);
    // Automatically start & supervise the Python LangGraph + Vector DB server
    await startPythonBackend();
  });
}

export default app;
