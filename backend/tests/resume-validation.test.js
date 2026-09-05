import { test, describe } from 'node:test';
import assert from 'node:assert';
import { uploadAndParseResume } from '../src/controllers/resumeController.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
}

describe('Production Resume File Validation Suite', () => {
  test('Rejects request with missing file', async () => {
    const req = { file: null, headers: {}, body: {} };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error, 'No resume file uploaded');
  });

  test('Rejects empty file (0 bytes)', async () => {
    const req = {
      file: {
        originalname: 'empty.pdf',
        buffer: Buffer.alloc(0),
        mimetype: 'application/pdf'
      },
      headers: {},
      body: {}
    };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('empty'));
  });

  test('Rejects files exceeding 5MB limit', async () => {
    const req = {
      file: {
        originalname: 'oversized.pdf',
        buffer: Buffer.alloc(5 * 1024 * 1024 + 10),
        mimetype: 'application/pdf'
      },
      headers: {},
      body: {}
    };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('5MB limit'));
  });

  test('Rejects renamed/corrupted PDF with invalid magic bytes', async () => {
    // Text content masquerading as .pdf
    const fakePdfBuffer = Buffer.from('Hello this is a plain text file');
    const req = {
      file: {
        originalname: 'fake.pdf',
        buffer: fakePdfBuffer,
        mimetype: 'application/pdf'
      },
      headers: {},
      body: {}
    };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('Corrupted or invalid PDF'));
  });

  test('Rejects renamed/corrupted DOCX with invalid magic bytes', async () => {
    // Text content masquerading as .docx
    const fakeDocxBuffer = Buffer.from('Not a zip archive');
    const req = {
      file: {
        originalname: 'fake.docx',
        buffer: fakeDocxBuffer,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      headers: {},
      body: {}
    };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('Corrupted or invalid Word document'));
  });

  test('Rejects unsupported file formats (e.g. .exe or .txt)', async () => {
    const req = {
      file: {
        originalname: 'script.sh',
        buffer: Buffer.from('#!/bin/bash\necho hello'),
        mimetype: 'text/plain'
      },
      headers: {},
      body: {}
    };
    const res = createMockRes();

    await uploadAndParseResume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('Unsupported file format'));
  });
});
