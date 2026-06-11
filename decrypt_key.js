const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const ALGORITHM = "aes-256-gcm";
const secret = process.env.API_KEY_ENCRYPTION_SECRET;
const key = Buffer.from(secret, "hex");

const mockKeys = JSON.parse(fs.readFileSync('.mock-api-keys.json', 'utf8'));

for (const inst in mockKeys) {
    const { gemini_api_key_encrypted, gemini_api_key_iv } = mockKeys[inst];
    const iv = Buffer.from(gemini_api_key_iv, 'base64');
    
    // WebCrypto AES-GCM appends a 16 byte auth tag to the end of the ciphertext.
    const ciphertext = Buffer.from(gemini_api_key_encrypted, 'base64');
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const encryptedData = ciphertext.subarray(0, ciphertext.length - 16);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log(`Key for ${inst}: ${decrypted}`);
    break; // Just need one working key
}
