import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role.toLowerCase(),
      login: user.login,
      displayName: user.childProfile?.displayName ?? null,
    },
  });
}
