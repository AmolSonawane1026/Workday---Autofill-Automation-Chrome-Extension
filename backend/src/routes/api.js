import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { uploadAndParseResume, parseResumeTextDirectly } from '../controllers/resumeController.js';
import { mapFormFields, answerQuestions, inferLocation } from '../controllers/aiController.js';
import { getTargetWorkdayFixtures } from '../controllers/automationController.js';
import { runFullPuppeteerAutomation, fillStepWithPuppeteer, getPuppeteerStatus } from '../controllers/puppeteerController.js';

const router = Router();

// Configure Multer for in-memory file uploads with 5MB limit (matching Workday standard)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc')) {
      cb(null, true);
    } else {
      const err = new Error('Unsupported file format. Workday accepts PDF (.pdf) and Word (.docx, .doc) documents only.');
      err.status = 400;
      cb(err);
    }
  }
});

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please slow down.' }
});

// Resume Endpoints
router.post('/resume/parse-file', upload.any(), uploadAndParseResume);
router.post('/resume/parse', upload.any(), uploadAndParseResume);
router.post('/resume/parse-text', parseResumeTextDirectly);

// AI Semantic Mapping & Geographic Reasoner Endpoints
router.post('/ai/map-fields', aiLimiter, mapFormFields);
router.post('/ai/answer-questions', aiLimiter, answerQuestions);
router.post('/ai/infer-location', aiLimiter, inferLocation);

// Automation & Fixtures
router.get('/automation/fixtures', getTargetWorkdayFixtures);

// Puppeteer-based Workday Automation (mirrors Workday-Application-Automator)
router.post('/automation/run-full', runFullPuppeteerAutomation);
router.post('/automation/fill-step', fillStepWithPuppeteer);
router.get('/automation/puppeteer-status', getPuppeteerStatus);

export default router;
