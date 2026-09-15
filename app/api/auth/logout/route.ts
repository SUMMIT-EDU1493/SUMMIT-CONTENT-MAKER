import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-config";
import { deleteSession } from "@/lib/auth-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  try {
    if (token) {
      await deleteSession(decodeURIComponent(token));
    }
  } catch (error) {
    console.error("[auth/logout] Failed to delete session:", error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
