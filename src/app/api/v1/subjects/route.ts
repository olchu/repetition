import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subjectIcons } from "@/lib/subject-catalog";

export async function GET() {
  if (!await getCurrentUser()) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  // Archived metadata is needed by historical results and existing assignments.
  const subjects = await prisma.subject.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
  return NextResponse.json({ subjects, icons: await subjectIcons() });
}
