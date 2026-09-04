import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  createSession,
  normalizeLogin,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  login?: unknown;
  password?: unknown;
  role?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;

  if (
    !body ||
    typeof body.login !== "string" ||
    typeof body.password !== "string" ||
    (body.role !== "child" && body.role !== "admin")
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Login details are required." } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { login: normalizeLogin(body.login) },
    include: { childProfile: true },
  });

  if (
    !user ||
    user.status === "BLOCKED" ||
    user.role.toLowerCase() !== body.role ||
    !(await bcrypt.compare(body.password, user.passwordHash))
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Invalid login details." } },
      { status: 401 },
    );
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      role: body.role,
      login: user.login,
      displayName: user.childProfile?.displayName ?? null,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });

  return response;
}
