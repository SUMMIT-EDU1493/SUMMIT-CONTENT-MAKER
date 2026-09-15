import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-config";
import { findUserForLogin, createSession } from "@/lib/auth-db";
import { verifyPassword } from "@/lib/auth-password";
import { createSessionToken } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "이메일과 비밀번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const user = await findUserForLogin(email);
    if (!user || !verifyPassword(password, String(user.password_hash))) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    await createSession(String(user.id), token);

    const response = NextResponse.json({
      user: {
        id: String(user.id),
        email: String(user.email),
        displayName: String(user.display_name),
        creditBalance: Number(user.credit_balance),
        createdAt: new Date(String(user.created_at)).toISOString(),
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("[auth/login] Failed to log in:", error);
    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
