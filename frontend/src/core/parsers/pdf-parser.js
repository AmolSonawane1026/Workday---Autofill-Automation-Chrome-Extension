import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsWorker) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Extract raw text AND embedded hyperlink annotations from a PDF
 * @param {ArrayBuffer|Uint8Array} fileData 
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(fileData) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: fileData,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let pageText = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }
      }

      // Extract embedded hyperlink annotations
      try {
        const annotations = await page.getAnnotations();
        if (annotations && annotations.length > 0) {
          pageText += '\n\n--- Embedded PDF Hyperlinks ---\n';
          for (const annot of annotations) {
            const url = annot.url || annot.unsafeUrl || (annot.action && annot.action.uri);
            if (url && typeof url === 'string') {
              pageText += `Link: ${url}\n`;
            }
          }
        }
      } catch (annotErr) {
        console.debug('Annotation extraction notice:', annotErr);
      }

      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF parsing error in browser:', error);
    throw new Error(`Failed to parse PDF document: ${error.message}`);
  }
}
