import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSubject } from "@/lib/subjects";
import { subjectIcons } from "@/lib/subject-catalog";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: { message: "Administrator access required." } }, { status: user ? 403 : 401 });
  const existing = await prisma.subject.findUnique({ where: { id: (await context.params).id } });
  if (!existing) return NextResponse.json({ error: { message: "Subject not found." } }, { status: 404 });
  const data = parseSubject(await request.json().catch(() => null));
  if (!data || data.slug !== existing.slug) return NextResponse.json({ error: { message: "Invalid subject fields. The slug cannot be changed." } }, { status: 400 });
  if (data.icon && !(await subjectIcons()).includes(data.icon)) return NextResponse.json({ error: { message: "Choose an existing icon." } }, { status: 422 });
  const subject = await prisma.subject.update({ where: { id: existing.id }, data });
  return NextResponse.json({ subject });
}
