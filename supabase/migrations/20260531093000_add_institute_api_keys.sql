-- Store encrypted Gemini API key per institute.
ALTER TABLE institutes
  ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key_iv TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key_set_at TIMESTAMPTZ;

-- Never expose encrypted key material to authenticated frontend clients.
REVOKE SELECT (gemini_api_key_encrypted, gemini_api_key_iv)
  ON institutes FROM authenticated;

COMMENT ON COLUMN institutes.gemini_api_key_encrypted IS
  'AES-256-GCM encrypted Gemini API key. Never exposed to frontend.';

COMMENT ON COLUMN institutes.gemini_api_key_iv IS
  'AES-256-GCM initialization vector for gemini_api_key_encrypted.';
