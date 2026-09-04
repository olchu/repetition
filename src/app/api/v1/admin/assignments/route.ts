import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AssignmentBody = {
  testId?: unknown;
  childIds?: unknown;
  groupId?: unknown;
};

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as AssignmentBody | null;
  const testId = typeof body?.testId === "string" ? body.testId : "";
  const childIds = Array.isArray(body?.childIds) && body.childIds.every((id) => typeof id === "string")
    ? body.childIds
    : [];
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const hasChildren = childIds.length > 0;
  const hasGroup = groupId.length > 0;

  if (!testId || hasChildren === hasGroup) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Choose a test and exactly one assignment target." } },
      { status: 400 },
    );
  }

  const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true, status: true, grade: true } });

  if (!test) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Test not found." } },
      { status: 404 },
    );
  }

  if (test.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: { code: "TEST_NOT_PUBLISHED", message: "Only published tests can be assigned." } },
      { status: 409 },
    );
  }

  if (!test.grade) {
    return NextResponse.json(
      { error: { code: "TEST_GRADE_REQUIRED", message: "Tests must specify a grade before assignment." } },
      { status: 409 },
    );
  }

  if (hasGroup) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, status: true, members: { select: { child: { select: { childProfile: { select: { grade: true } } } } } } },
    });

    if (!group || group.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { code: "INVALID_GROUP", message: "Active group not found." } },
        { status: 422 },
      );
    }

    if (group.members.some((member) => member.child.childProfile?.grade !== test.grade)) {
      return NextResponse.json(
        { error: { code: "GRADE_MISMATCH", message: `Every child in the group must be in grade ${test.grade}.` } },
        { status: 422 },
      );
    }

    const existing = await prisma.assignment.findFirst({
      where: { testId, groupId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ assignments: [], skipped: 1 });
    }

    const assignment = await prisma.assignment.create({ data: { testId, groupId } });
    return NextResponse.json({ assignments: [assignment], skipped: 0 }, { status: 201 });
  }

  const children = await prisma.user.findMany({
    where: { id: { in: childIds }, role: "CHILD", status: "ACTIVE" },
    select: { id: true, childProfile: { select: { grade: true } } },
  });
  const foundIds = new Set(children.map((child) => child.id));
  const missingIds = childIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CHILDREN",
          message: "One or more children are missing or blocked.",
          details: missingIds.map((id) => ({ id })),
        },
      },
      { status: 422 },
    );
  }

  if (children.some((child) => child.childProfile?.grade !== test.grade)) {
    return NextResponse.json(
      { error: { code: "GRADE_MISMATCH", message: `Tests for grade ${test.grade} can only be assigned to children in that grade.` } },
      { status: 422 },
    );
  }

  const assignments = await prisma.$transaction(async (transaction) => {
    const created = [];

    for (const childId of childIds) {
      const existing = await transaction.assignment.findFirst({
        where: { testId, childId, status: "ACTIVE" },
        select: { id: true },
      });

      if (!existing) {
        created.push(await transaction.assignment.create({ data: { testId, childId } }));
      }
    }

    return created;
  });

  return NextResponse.json(
    { assignments, skipped: childIds.length - assignments.length },
    { status: assignments.length > 0 ? 201 : 200 },
  );
}
