import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

/**
 * Extract raw text from uploaded PDF buffer
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text ? data.text.trim() : '';
  } catch (error) {
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  }
}

/**
 * Extract raw text from uploaded DOCX buffer
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ? result.value.trim() : '';
  } catch (error) {
    throw new Error(`Failed to parse DOCX file: ${error.message}`);
  }
}

/**
 * Clean and normalize extracted resume text
 * @param {string} text 
 * @returns {string}
 */
export function normalizeResumeText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
