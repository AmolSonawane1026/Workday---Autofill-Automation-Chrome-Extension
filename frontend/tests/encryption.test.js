import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../src/core/security/encryption.js';

describe('Web Crypto AES-GCM Encryption Suite', () => {
  it('should encrypt and decrypt a secret string accurately', async () => {
    const rawApiKey = 'test_sample_secure_secret_token_123456789';
    
    const encrypted = await encryptSecret(rawApiKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(rawApiKey);

    const decrypted = await decryptSecret(encrypted.ciphertext, encrypted.iv);
    expect(decrypted).toBe(rawApiKey);
  });

  it('should handle empty string gracefully', async () => {
    const result = await encryptSecret('');
    expect(result.ciphertext).toBe('');
    expect(result.iv).toBe('');
  });
});
