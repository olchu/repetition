import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/student-overview";

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  return NextResponse.json(
    await loadStudentOverview({
      id: user.id,
      displayName: user.childProfile?.displayName ?? user.login,
      subjects: (user.childProfile?.subjects ?? []).map((item) => item.subject.slug),
    }),
  );
}
