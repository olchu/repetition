import { TestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const statusParam = new URL(request.url).searchParams.get("status")?.toUpperCase();
  const status =
    statusParam === "DRAFT" || statusParam === "PUBLISHED" || statusParam === "ARCHIVED"
      ? (statusParam as TestStatus)
      : undefined;
  const tests = await prisma.test.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      stableId: true,
      version: true,
      title: true,
      subject: true,
      grade: true,
      status: true,
      createdAt: true,
      passPercentage: true,
      questionCount: true,
      _count: { select: { assignments: true } },
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
  });

  return NextResponse.json({
    tests: tests.map((test) => ({
      ...test,
      subject: test.subject.toLowerCase(),
      status: test.status.toLowerCase(),
      assignmentCount: test._count.assignments,
      _count: undefined,
    })),
  });
}
