import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PASSWORD_KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PASSWORD_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return `${PASSWORD_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [prefix, salt, keyHex] = storedHash.split("$");

  if (
    prefix !== PASSWORD_PREFIX ||
    !salt ||
    !keyHex ||
    keyHex.length !== PASSWORD_KEY_LENGTH * 2
  ) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(keyHex, "hex");
    const actualKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
    return timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}
