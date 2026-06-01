import "server-only";

const ALGORITHM = "AES-GCM";

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error("API_KEY_ENCRYPTION_SECRET must be a 32-byte hex string (64 chars)");
  }

  return crypto.subtle.importKey(
    "raw",
    Buffer.from(secret, "hex"),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptApiKey(
  plaintext: string,
): Promise<{ encrypted: string; iv: string }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);

  return {
    encrypted: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

export async function decryptApiKey(encrypted: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const ciphertext = Buffer.from(encrypted, "base64");
  const ivBytes = Buffer.from(iv, "base64");
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
