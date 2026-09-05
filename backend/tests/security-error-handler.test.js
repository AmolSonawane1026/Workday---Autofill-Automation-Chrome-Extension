import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeErrorMessage, categorizeError, sendSecureError } from '../src/utils/securityErrorHandler.js';

describe('Production-Grade Security Error Handling Suite', () => {
  test('Redacts Google Gemini API keys from error messages', () => {
    const raw = 'Error contacting Google API at https://generativelanguage.googleapis.com?key=AIzaSyA1234567890abcdefghijklmnopqrstuv: API key not valid';
    const sanitized = sanitizeErrorMessage(raw);
    assert.strictEqual(sanitized.includes('AIzaSyA1234567890abcdefghijklmnopqrstuv'), false);
    assert.ok(sanitized.includes('[REDACTED]'));
  });

  test('Redacts OpenAI API keys from error messages', () => {
    const raw = 'Failed authentication with secret key sk-proj-1234567890abcdef1234567890';
    const sanitized = sanitizeErrorMessage(raw);
    assert.strictEqual(sanitized.includes('sk-proj-1234567890abcdef1234567890'), false);
    assert.ok(sanitized.includes('[REDACTED_CREDENTIAL]'));
  });

  test('Redacts passwords and sensitive query params', () => {
    const raw = 'Login failed for user with payload {"password": "SuperSecretPassword123!"} at /auth?token=Bearer_secret123';
    const sanitized = sanitizeErrorMessage(raw);
    assert.strictEqual(sanitized.includes('SuperSecretPassword123!'), false);
    assert.strictEqual(sanitized.includes('Bearer_secret123'), false);
  });

  test('Sanitizes internal server absolute paths', () => {
    const raw = 'ENOENT: no such file or directory, open C:\\Users\\sonaw\\Desktop\\app\\secret.json';
    const sanitized = sanitizeErrorMessage(raw);
    assert.strictEqual(sanitized.includes('C:\\Users\\sonaw\\Desktop\\app\\secret.json'), false);
    assert.ok(sanitized.includes('[.../secret.json]'));
  });

  test('Categorizes Multer LIMIT_FILE_SIZE as 400 Bad Request with friendly message', () => {
    const err = new Error('File too large');
    err.code = 'LIMIT_FILE_SIZE';
    const cat = categorizeError(err);
    assert.strictEqual(cat.status, 400);
    assert.ok(cat.message.includes('5MB limit'));
  });

  test('Categorizes SyntaxError (malformed JSON) as 400 Bad Request', () => {
    const err = new SyntaxError('Unexpected token } in JSON at position 42');
    err.body = '{ "name": }';
    const cat = categorizeError(err);
    assert.strictEqual(cat.status, 400);
    assert.strictEqual(cat.message, 'Invalid JSON payload provided.');
  });

  test('Categorizes AI authentication failures as 401 Unauthorized', () => {
    const err = new Error('API_KEY_INVALID: Please provide a valid key.');
    const cat = categorizeError(err);
    assert.strictEqual(cat.status, 401);
    assert.ok(cat.message.includes('AI authentication failed'));
  });

  test('Categorizes AI quota / rate limit errors as 429 Too Many Requests', () => {
    const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
    const cat = categorizeError(err);
    assert.strictEqual(cat.status, 429);
    assert.ok(cat.message.includes('rate limit or quota exceeded'));
  });

  test('sendSecureError sets status code and redacts sensitive error fields in response', () => {
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; }
    };

    const sensitiveErr = new Error('Google error key=AIzaSy12345678901234567890123456789012345 failed');
    sensitiveErr.status = 400;

    sendSecureError(res, sensitiveErr);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonBody.success, false);
    assert.strictEqual(jsonBody.error.includes('AIzaSy'), false);
    assert.ok(jsonBody.error.includes('REDACTED'));
  });
});
