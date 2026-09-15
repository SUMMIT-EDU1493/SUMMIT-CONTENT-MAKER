import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import { SIGNUP_TRIAL_CREDITS } from "@/lib/auth-config";
import { hashPassword } from "@/lib/auth-password";
import {
  hashSessionToken,
  sessionExpiresAt,
} from "@/lib/auth-session";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  creditBalance: number;
  createdAt: string;
};

function database() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return neon(databaseUrl);
}

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    creditBalance: Number(row.credit_balance),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createUserWithTrialCredit({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthUser> {
  const userId = randomUUID();
  const transactionId = randomUUID();
  const passwordHash = hashPassword(password);
  const sql = database();
  const rows = await sql`
    WITH new_user AS (
      INSERT INTO users (
        id,
        email,
        password_hash,
        display_name,
        credit_balance
      )
      VALUES (
        ${userId},
        ${email},
        ${passwordHash},
        ${displayName},
        ${SIGNUP_TRIAL_CREDITS}
      )
      RETURNING id, email, display_name, credit_balance, created_at
    ), new_credit_transaction AS (
      INSERT INTO credit_transactions (
        id,
        user_id,
        amount,
        transaction_type
      )
      SELECT
        ${transactionId},
        id,
        ${SIGNUP_TRIAL_CREDITS},
        'signup_bonus'
      FROM new_user
    )
    SELECT id, email, display_name, credit_balance, created_at
    FROM new_user
  `;

  if (!rows[0]) {
    throw new Error("회원가입에 실패했습니다.");
  }

  return toAuthUser(rows[0]);
}

export async function findUserForLogin(email: string) {
  const sql = database();
  const rows = await sql`
    SELECT id, email, display_name, password_hash, credit_balance, created_at
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createSession(userId: string, token: string) {
  const sql = database();
  const expiresAt = sessionExpiresAt();
  await sql`
    INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${hashSessionToken(token)},
      ${expiresAt.toISOString()}
    )
  `;
  return expiresAt;
}

export async function findUserBySessionToken(token: string): Promise<AuthUser | null> {
  const sql = database();
  const rows = await sql`
    SELECT
      users.id,
      users.email,
      users.display_name,
      users.credit_balance,
      users.created_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashSessionToken(token)}
      AND sessions.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function deleteSession(token: string) {
  const sql = database();
  await sql`
    DELETE FROM sessions
    WHERE token_hash = ${hashSessionToken(token)}
  `;
}
