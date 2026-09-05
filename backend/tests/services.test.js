import { test, describe } from 'node:test';
import assert from 'node:assert';
import { normalizeResumeText } from '../src/services/parserService.js';
import { mapFieldsHeuristically } from '../src/services/aiService.js';

describe('Backend Services Unit Tests', () => {
  test('normalizeResumeText cleans redundant whitespace and returns trimmed text', () => {
    const raw = '   John    Doe   \r\n\r\n\r\n  Software Engineer   \n\n\n\n Skills: React, Node   ';
    const cleaned = normalizeResumeText(raw);
    assert.strictEqual(cleaned.includes('   '), false);
    assert.strictEqual(cleaned.includes('John Doe'), true);
  });

  test('mapFieldsHeuristically accurately identifies standard Workday fields', () => {
    const mockFields = [
      { id: 'f1', label: 'First Name', automationId: 'legalNameSection_firstName', type: 'text' },
      { id: 'f2', label: 'Last Name', automationId: 'legalNameSection_lastName', type: 'text' },
      { id: 'f3', label: 'Email', automationId: 'email', type: 'email' },
      { id: 'f4', label: 'Phone Number', automationId: 'phoneNumber', type: 'tel' },
      { id: 'f5', label: 'City', automationId: 'addressSection_city', type: 'text' }
    ];

    const mockResume = {
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1-555-0199',
        address: {
          city: 'Santa Clara'
        }
      }
    };

    const results = mapFieldsHeuristically(mockFields, mockResume);

    assert.strictEqual(results.length, 5);
    assert.strictEqual(results.find(r => r.id === 'f1').value, 'Jane');
    assert.strictEqual(results.find(r => r.id === 'f2').value, 'Smith');
    assert.strictEqual(results.find(r => r.id === 'f3').value, 'jane.smith@example.com');
    assert.strictEqual(results.find(r => r.id === 'f4').value, '+1-555-0199');
    assert.strictEqual(results.find(r => r.id === 'f5').value, 'Santa Clara');
  });
});
