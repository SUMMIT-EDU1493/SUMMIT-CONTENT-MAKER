import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-config";
import { findUserBySessionToken } from "@/lib/auth-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  try {
    const user = await findUserBySessionToken(decodeURIComponent(token));
    return NextResponse.json({
      authenticated: Boolean(user),
      user,
    });
  } catch (error) {
    console.error("[auth/me] Failed to read session:", error);
    return NextResponse.json(
      { error: "회원 정보를 확인할 수 없습니다." },
      { status: 500 }
    );
  }
}
