import { Prisma, TestStatus } from "@prisma/client";
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

  const searchParams = new URL(request.url).searchParams;
  const statusParam = searchParams.get("status")?.toUpperCase();
  const status =
    statusParam === "DRAFT" || statusParam === "PUBLISHED" || statusParam === "ARCHIVED"
      ? (statusParam as TestStatus)
      : undefined;
  const search = searchParams.get("search")?.trim().slice(0, 100) ?? "";
  const grade = searchParams.get("grade")?.trim().slice(0, 50) ?? "";
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const requestedPageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10);
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 50) : 10;
  const unpaginated = searchParams.get("all") === "true";
  const where: Prisma.TestWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    ...(grade ? { grade } : {}),
  };
  const [totalItems, publishedItems, gradeRows] = await Promise.all([
    prisma.test.count({ where }),
    prisma.test.count({ where: { status: "PUBLISHED" } }),
    prisma.test.findMany({
      where: { grade: { not: null } },
      distinct: ["grade"],
      select: { grade: true },
    }),
  ]);
  const totalPages = unpaginated ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const page = unpaginated
    ? 1
    : Math.min(Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1, totalPages);
  const tests = await prisma.test.findMany({
    where,
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
    orderBy: [{ createdAt: "desc" }, { version: "desc" }, { id: "desc" }],
    ...(unpaginated ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
  });

  return NextResponse.json({
    tests: tests.map((test) => ({
      ...test,
      subject: test.subject.toLowerCase(),
      status: test.status.toLowerCase(),
      assignmentCount: test._count.assignments,
      _count: undefined,
    })),
    pagination: {
      page,
      pageSize: unpaginated ? totalItems : pageSize,
      totalItems,
      totalPages,
    },
    filters: {
      grades: gradeRows
        .map(({ grade: value }) => value)
        .filter((value): value is string => value !== null)
        .sort((first, second) => first.localeCompare(second, undefined, { numeric: true })),
    },
    summary: { publishedItems },
  });
}
