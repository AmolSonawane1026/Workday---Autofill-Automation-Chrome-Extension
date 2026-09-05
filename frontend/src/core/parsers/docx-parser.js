import mammoth from 'mammoth';

/**
 * Extract raw text from a DOCX ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(arrayBuffer) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value ? result.value.trim() : '';
  } catch (error) {
    console.error('DOCX parsing error in browser:', error);
    throw new Error(`Failed to parse DOCX document: ${error.message}`);
  }
}
