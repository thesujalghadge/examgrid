import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a hex string in the format: iv:authTag:encryptedData
 */
export function encrypt(text: string, secret: string): string {
  if (!text) return '';
  if (!secret || secret.length !== 32) {
    throw new Error('Encryption secret must be exactly 32 characters long.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secret, 'utf8'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 * Expects a hex string in the format: iv:authTag:encryptedData
 */
export function decrypt(cipherText: string, secret: string): string {
  if (!cipherText) return '';
  if (!secret || secret.length !== 32) {
    throw new Error('Encryption secret must be exactly 32 characters long.');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipher text format. Expected iv:authTag:encryptedData');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    Buffer.from(secret, 'utf8'), 
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
