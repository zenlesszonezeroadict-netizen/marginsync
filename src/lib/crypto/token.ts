import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY env var is not set')
  const buf = Buffer.from(key, 'hex')
  if (buf.byteLength !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a Base64-encoded payload: iv (12B) + authTag (16B) + ciphertext.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypts a payload produced by encryptToken.
 */
export function decryptToken(payload: string): string {
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  if (buf.byteLength < IV_BYTES + TAG_BYTES + 1) throw new Error('Invalid encrypted token payload')
  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
