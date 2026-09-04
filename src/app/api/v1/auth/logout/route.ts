import { NextResponse } from "next/server";
import {
  deleteCurrentSession,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST() {
  await deleteCurrentSession();

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
