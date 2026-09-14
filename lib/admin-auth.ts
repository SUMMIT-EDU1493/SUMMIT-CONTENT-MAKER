import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "summit_admin";

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

export function isAdminConfigured(): boolean {
  return configuredPassword().length >= 8;
}

export function adminCookieValue(): string {
  return createHash("sha256")
    .update(configuredPassword())
    .digest("hex");
}

export function passwordMatches(password: string): boolean {
  if (!isAdminConfigured()) return false;

  const expected = Buffer.from(adminCookieValue(), "utf8");
  const actual = Buffer.from(
    createHash("sha256").update(password).digest("hex"),
    "utf8"
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function cookieMatches(value: string | undefined): boolean {
  if (!value || !isAdminConfigured()) return false;
  const expected = Buffer.from(adminCookieValue(), "utf8");
  const actual = Buffer.from(value, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
