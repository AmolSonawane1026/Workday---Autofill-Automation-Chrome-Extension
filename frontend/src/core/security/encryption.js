/**
 * Production-grade AES-GCM 256-bit encryption utility
 * Uses native Web Crypto API (SubtleCrypto)
 */

const SALT = new Uint8Array([72, 105, 100, 97, 110, 105, 84, 101, 99, 104, 65, 117, 116, 111, 102, 105]); // "HidaniTechAutofi"
const ITERATIONS = 100000;

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
  if (typeof self !== 'undefined' && self.crypto) return self.crypto;
  throw new Error('Web Crypto API is not supported in this environment.');
}

/**
 * Derive an AES-GCM CryptoKey from a master passphrase and salt
 * @param {string} [passphrase] 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase = 'workday-autofill-device-master-key') {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-GCM
 * @param {string} plaintext 
 * @param {string} [passphrase] 
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptSecret(plaintext, passphrase) {
  if (!plaintext) return { ciphertext: '', iv: '' };
  
  const cryptoObj = getCrypto();
  const key = await deriveKey(passphrase);
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encryptedBuffer = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(new Uint8Array(encryptedBuffer)),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypt an AES-GCM encrypted payload
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {string} [passphrase] 
 * @returns {Promise<string>}
 */
export async function decryptSecret(ciphertextBase64, ivBase64, passphrase) {
  if (!ciphertextBase64 || !ivBase64) return '';

  const cryptoObj = getCrypto();
  const key = await deriveKey(passphrase);
  const ciphertext = base64ToBuffer(ciphertextBase64);
  const iv = base64ToBuffer(ivBase64);

  try {
    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt secret. Key mismatch or corrupted data.');
  }
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
