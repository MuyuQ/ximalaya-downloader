import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { chmod } from 'fs';
import { fileExists, readFile, writeFile } from './fileUtils.js';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 加密密钥文件路径
 * @description 默认为当前目录下的 .encryption.key，可通过环境变量 XIMALAYA_KEY_PATH 覆盖
 *   （便于测试与自定义存储位置）。
 * @type {string}
 * @private
 */
const KEY_FILE_PATH = process.env.XIMALAYA_KEY_PATH || './.encryption.key';

let cachedKey = null;

/**
 * 重置密钥缓存（仅测试使用）
 * @returns {void}
 */
export function resetKeyCache() {
  cachedKey = null;
}

export async function getEncryptionKey() {
  if (cachedKey) {
    return cachedKey;
  }

  const envKey = process.env.XIMALAYA_ENCRYPTION_KEY;
  if (envKey) {
    cachedKey = Buffer.from(envKey, 'hex');
    return cachedKey;
  }

  if (await fileExists(KEY_FILE_PATH)) {
    const keyData = await readFile(KEY_FILE_PATH);
    cachedKey = Buffer.from(keyData.trim(), 'hex');
    return cachedKey;
  }

  const newKey = randomBytes(KEY_LENGTH);
  await writeFile(KEY_FILE_PATH, newKey.toString('hex'));
  // 密钥文件权限收紧为仅所有者可读写
  try {
    await new Promise((resolve, reject) => chmod(KEY_FILE_PATH, 0o600, err => (err ? reject(err) : resolve())));
  } catch {
    // Windows 等平台不支持 POSIX 权限时忽略
  }
  console.log('已生成新的加密密钥并保存到', KEY_FILE_PATH);
  console.log('请妥善保管此文件（建议备份），丢失后将无法解密已保存的 Cookie');
  cachedKey = newKey;
  return newKey;
}

export function encryptCookie(plainText, key) {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('待加密的Cookie不能为空');
  }
  if (!key || key.length !== KEY_LENGTH) {
    throw new Error('加密密钥无效，长度必须为32字节');
  }

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const derivedKey = scryptSync(key, salt, KEY_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
  return result.toString('base64');
}

export function decryptCookie(encryptedBase64, key) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
    throw new Error('待解密的Cookie不能为空');
  }
  if (!key || key.length !== KEY_LENGTH) {
    throw new Error('加密密钥无效，长度必须为32字节');
  }

  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

  const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
  const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedBuffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encryptedData = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = scryptSync(key, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function isEncryptedCookie(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
