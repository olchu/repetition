import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const updated = await prisma.test.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "PUBLISHED" },
  });

  if (updated.count === 0) {
    const test = await prisma.test.findUnique({ where: { id }, select: { id: true, status: true } });

    return NextResponse.json(
      {
        error: {
          code: test ? "INVALID_STATUS" : "NOT_FOUND",
          message: test ? "Only draft tests can be published." : "Test not found.",
        },
      },
      { status: test ? 409 : 404 },
    );
  }

  const test = await prisma.test.findUniqueOrThrow({
    where: { id },
    select: { id: true, stableId: true, version: true, status: true, passPercentage: true },
  });

  return NextResponse.json({
    test: { ...test, status: test.status.toLowerCase() },
  });
}
