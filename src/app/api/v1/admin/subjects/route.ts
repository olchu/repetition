import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSubject } from "@/lib/subjects";
import { subjectIcons } from "@/lib/subject-catalog";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: { message: "Administrator access required." } }, { status: user ? 403 : 401 });
  const data = parseSubject(await request.json().catch(() => null));
  if (!data) return NextResponse.json({ error: { message: "Invalid subject fields. Use a stable slug, a name, hex colors and an icon path under /icons/." } }, { status: 400 });
  if (data.icon && !(await subjectIcons()).includes(data.icon)) return NextResponse.json({ error: { message: "Choose an existing icon." } }, { status: 422 });
  try {
    const subject = await prisma.subject.create({ data });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return NextResponse.json({ error: { message: "This subject slug already exists." } }, { status: 409 });
    throw error;
  }
}
