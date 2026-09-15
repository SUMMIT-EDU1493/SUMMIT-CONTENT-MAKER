import { NextResponse } from "next/server";
import { createUserWithTrialCredit } from "@/lib/auth-db";

export const runtime = "nodejs";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  const displayName = body.displayName?.trim() || "";

  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json(
      { error: "올바른 이메일을 입력해 주세요." },
      { status: 400 }
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "비밀번호는 8자 이상 128자 이하로 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!displayName || displayName.length > 80) {
    return NextResponse.json(
      { error: "표시 이름을 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const user = await createUserWithTrialCredit({
      email,
      password,
      displayName,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "이미 가입된 이메일입니다." },
        { status: 409 }
      );
    }

    console.error("[auth/signup] Failed to create user:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
