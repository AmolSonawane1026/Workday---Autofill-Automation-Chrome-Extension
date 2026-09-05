import { extractTextFromPdf, extractTextFromDocx, normalizeResumeText } from '../services/parserService.js';
import { parseResumeWithAI } from '../services/aiService.js';
import { sendSecureError } from '../utils/securityErrorHandler.js';

export async function uploadAndParseResume(req, res) {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return res.status(400).json({ success: false, error: 'No resume file uploaded' });
    }

    const { originalname, buffer, mimetype } = file;

    // 1. Check for empty file
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'The uploaded file is empty (0 bytes). Please upload a valid resume.' });
    }

    // 2. Enforce Workday's standard 5MB file size limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, error: 'File size exceeds Workday\'s 5MB limit. Please upload a smaller file.' });
    }

    const apiKey = req.headers['x-gemini-key'] || req.headers['x-openai-key'] || req.body.apiKey;
    const model = req.body.model || 'gemini-1.5-flash';

    let rawText = '';
    const filename = originalname.toLowerCase();
    const isPdf = filename.endsWith('.pdf') || mimetype === 'application/pdf';
    const isDocx = filename.endsWith('.docx') || filename.endsWith('.doc') || mimetype.includes('wordprocessingml');

    // 3. Binary Magic Byte Validation
    if (isPdf) {
      const isPdfHeader = buffer.length >= 4 &&
        buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
      if (!isPdfHeader) {
        return res.status(400).json({ success: false, error: 'Corrupted or invalid PDF file structure. Please upload a valid PDF resume.' });
      }
      rawText = await extractTextFromPdf(buffer);
    } else if (isDocx) {
      const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B; // PK (DOCX)
      const isDoc = buffer.length >= 2 && buffer[0] === 0xD0 && buffer[1] === 0xCF; // Compound file (.doc)
      if (!isZip && !isDoc) {
        return res.status(400).json({ success: false, error: 'Corrupted or invalid Word document structure. Please upload a valid DOCX/DOC resume.' });
      }
      rawText = await extractTextFromDocx(buffer);
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Workday accepts PDF (.pdf) and Word (.docx, .doc) documents only.' });
    }

    const cleanText = normalizeResumeText(rawText);
    if (!cleanText || cleanText.length < 20) {
      return res.status(400).json({ success: false, error: 'Could not extract readable text from resume.' });
    }

    const structuredData = await parseResumeWithAI(cleanText, apiKey, model);

    return res.status(200).json({
      success: true,
      message: 'Resume parsed successfully',
      data: {
        filename: originalname,
        profile: structuredData
      },
      profile: structuredData
    });
  } catch (error) {
    return sendSecureError(res, error, 'Failed to process resume');
  }
}

export async function parseResumeTextDirectly(req, res) {
  try {
    const { text, model } = req.body;
    const apiKey = req.headers['x-gemini-key'] || req.headers['x-openai-key'] || req.body.apiKey;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Resume text is required' });
    }

    const cleanText = normalizeResumeText(text);
    const profile = await parseResumeWithAI(cleanText, apiKey, model);

    return res.status(200).json({
      success: true,
      data: { profile },
      profile
    });
  } catch (error) {
    return sendSecureError(res, error, 'Failed to parse resume text');
  }
}
