import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadStudentHistory, parseHistoryCursor } from "@/lib/student-history-server";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Child access required." } }, { status: user ? 403 : 401 });
  }
  const value = new URL(request.url).searchParams.get("cursor");
  const cursor = value === null ? null : parseHistoryCursor(value);
  if (value !== null && !cursor) {
    return NextResponse.json({ error: { code: "INVALID_CURSOR", message: "Invalid history cursor." } }, { status: 400 });
  }
  return NextResponse.json(await loadStudentHistory(user.id, cursor), { headers: { "Cache-Control": "private, no-store" } });
}
