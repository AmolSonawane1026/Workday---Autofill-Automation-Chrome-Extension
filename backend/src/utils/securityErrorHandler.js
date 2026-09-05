/**
 * Error handling utilities for sanitizing stack traces and redacting sensitive credentials.
 */

const SENSITIVE_PATTERNS = [
  // Google Gemini API keys (AIza...)
  { regex: /AIza[0-9A-Za-z\-_]{35}/g, replacement: '[REDACTED_CREDENTIAL]' },
  // OpenAI API keys (sk-...)
  { regex: /sk-[0-9A-Za-z\-_]{20,}/g, replacement: '[REDACTED_CREDENTIAL]' },
  // Anthropic API keys (sk-ant-...)
  { regex: /sk-ant-[0-9A-Za-z\-_]{20,}/g, replacement: '[REDACTED_CREDENTIAL]' },
  // Bearer tokens
  { regex: /Bearer\s+[A-Za-z0-9\-_.]+/gi, replacement: 'Bearer [REDACTED]' },
  // Query param keys (e.g. ?key=... or &api_key=...)
  { regex: /([?&](?:key|apiKey|api_key|password|pass|token|auth)=)[^&\s]+/gi, replacement: '$1[REDACTED]' },
  // JSON password fields: "password": "..."
  { regex: /("(?:password|apiKey|api_key|geminiApiKey)":\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' }
];

// Absolute filesystem paths (Windows and POSIX)
const FILEPATH_PATTERN = /(?:[A-Za-z]:\\[a-zA-Z0-9_\-\\.]+|\/(?:[a-zA-Z0-9_\-\\.]+\/)+[a-zA-Z0-9_\-\\.]+)/g;

/**
 * Sanitizes any error message or string by redacting API keys, passwords, and server filepaths.
 */
export function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'An unexpected error occurred.';
  }

  let sanitized = message;

  // 1. Redact API keys and passwords
  for (const item of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(item.regex, item.replacement);
  }

  // 2. Redact internal server paths if found
  sanitized = sanitized.replace(FILEPATH_PATTERN, (match) => {
    // Keep short extensions/words if not a real path
    if (!match.includes('/') && !match.includes('\\')) return match;
    const parts = match.split(/[/\\]/);
    return parts[parts.length - 1] ? `[.../${parts[parts.length - 1]}]` : '[.../file]';
  });

  return sanitized.trim();
}

/**
 * Maps technical or SDK error messages to secure, user-friendly, actionable responses with correct HTTP status codes.
 */
export function categorizeError(error) {
  if (!error) {
    return { status: 500, message: 'Internal Server Error' };
  }

  const rawMsg = String(error.message || error);
  const lower = rawMsg.toLowerCase();

  // 1. File Upload / Multer Limits
  if (error.code === 'LIMIT_FILE_SIZE' || lower.includes('file size') || lower.includes('5mb')) {
    return {
      status: 400,
      message: "File size exceeds Workday's 5MB limit. Please upload a file smaller than 5MB."
    };
  }

  if (error.name === 'MulterError') {
    return {
      status: 400,
      message: sanitizeErrorMessage(error.message || 'File upload error occurred.')
    };
  }

  // 2. Syntax / Malformed JSON body
  if (error instanceof SyntaxError && ('body' in error || lower.includes('json'))) {
    return {
      status: 400,
      message: 'Invalid JSON payload provided.'
    };
  }

  // 3. AI Authentication / Quota Errors
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid api key') ||
    lower.includes('api key not valid')
  ) {
    return {
      status: 401,
      message: 'AI authentication failed. Please verify your Gemini/OpenAI API key.'
    };
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    error.status === 429
  ) {
    return {
      status: 429,
      message: 'AI service rate limit or quota exceeded. Please try again in a few moments.'
    };
  }

  // 4. File Structure & Validation Errors
  if (
    lower.includes('empty') ||
    lower.includes('corrupted') ||
    lower.includes('invalid pdf') ||
    lower.includes('invalid word') ||
    lower.includes('unsupported file format')
  ) {
    return {
      status: 400,
      message: sanitizeErrorMessage(rawMsg)
    };
  }

  // 5. Existing HTTP Status code on error object
  const status = Number(error.status) || Number(error.statusCode) || 500;
  if (status >= 400 && status < 500) {
    return {
      status,
      message: sanitizeErrorMessage(rawMsg)
    };
  }

  // 6. Generic 500 Server Error
  const isProd = process.env.NODE_ENV === 'production';
  return {
    status: 500,
    message: isProd ? 'Internal Server Error. Please try again later.' : sanitizeErrorMessage(rawMsg)
  };
}

/**
 * Secure HTTP response handler for controllers and middleware.
 */
export function sendSecureError(res, error, defaultMessage = 'Operation failed') {
  const { status, message } = categorizeError(error);
  
  // Server-side safe logging with credentials scrubbed
  const safeLogMsg = sanitizeErrorMessage(error?.stack || error?.message || String(error));
  if (status >= 500) {
    console.error(`[SecureError ${status}]:`, safeLogMsg);
  } else {
    console.warn(`[ClientNotice ${status}]:`, sanitizeErrorMessage(error?.message || message));
  }

  return res.status(status).json({
    success: false,
    error: message || defaultMessage
  });
}
