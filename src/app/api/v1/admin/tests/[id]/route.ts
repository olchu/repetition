import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const test = await prisma.test.findUnique({
    where: { id: (await context.params).id },
    include: {
      questions: {
        include: { options: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!test) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Test not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    test: {
      id: test.id,
      stableId: test.stableId,
      version: test.version,
      title: test.title,
      description: test.description,
      subject: test.subject.toLowerCase(),
      grade: test.grade,
      passPercentage: test.passPercentage,
      status: test.status.toLowerCase(),
      questions: test.questions.map((question) => ({
        id: question.externalId,
        text: question.text,
        points: question.points,
        explanation: question.explanation,
        options: question.options.map((option) => ({ id: option.externalId, text: option.text, isCorrect: option.isCorrect })),
      })),
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { action } = (await request.json().catch(() => ({}))) as { action?: unknown };

  const { id } = await context.params;
  const expectedStatus = action === "archive" ? "PUBLISHED" : action === "restore" ? "ARCHIVED" : null;
  const nextStatus = action === "archive" ? "ARCHIVED" : action === "restore" ? "PUBLISHED" : null;

  if (!expectedStatus || !nextStatus) {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Unsupported test action." } },
      { status: 400 },
    );
  }

  const updated = await prisma.test.updateMany({
    where: { id, status: expectedStatus },
    data: { status: nextStatus },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: `Only ${expectedStatus.toLowerCase()} tests can be ${action}d.` } },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: nextStatus.toLowerCase() });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const test = await prisma.test.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, _count: { select: { assignments: true } } },
  });

  if (!test) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Test not found." } },
      { status: 404 },
    );
  }

  if (test.status !== "ARCHIVED" && test.status !== "DRAFT") {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: "Archive a published test before deleting it." } },
      { status: 409 },
    );
  }

  if (test._count.assignments > 0) {
    return NextResponse.json(
      { error: { code: "TEST_HAS_HISTORY", message: "This test has assignments or results and must be kept for history. You can restore it instead." } },
      { status: 409 },
    );
  }

  await prisma.test.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
