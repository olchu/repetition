import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { newestPublishedTests } from "@/lib/test-sets";

type RouteContext = { params: Promise<{ id: string }> };

type AssignBody = { childIds?: unknown; groupId?: unknown };

/**
 * Assigns every test of a set to children or to one group: the newest
 * published version of each. As with single tests, children only receive
 * tests of their own grade; a group receives all of them. Tests already
 * assigned to the target are skipped, and the counts say what happened.
 */
export async function POST(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as AssignBody | null;
  const childIds = Array.isArray(body?.childIds) && body.childIds.every((childId) => typeof childId === "string")
    ? [...new Set(body.childIds as string[])]
    : [];
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";

  if ((childIds.length > 0) === (groupId.length > 0)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Choose exactly one target: children or a group." } },
      { status: 400 },
    );
  }

  const set = await prisma.testSet.findUnique({ where: { id }, include: { items: { select: { stableId: true } } } });

  if (!set) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Set not found." } }, { status: 404 });
  }

  const tests = [...(await newestPublishedTests(set.items.map((item) => item.stableId))).values()];
  const notPublished = set.items.length - tests.length;

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { status: true } });

    if (!group || group.status !== "ACTIVE") {
      return NextResponse.json({ error: { code: "INVALID_GROUP", message: "Active group not found." } }, { status: 422 });
    }

    const assigned = await prisma.$transaction(async (transaction) => {
      let created = 0;
      for (const test of tests) {
        const existing = await transaction.assignment.findFirst({ where: { testId: test.id, groupId, status: "ACTIVE" }, select: { id: true } });
        if (!existing) {
          await transaction.assignment.create({ data: { testId: test.id, groupId } });
          created += 1;
        }
      }
      return created;
    });

    return NextResponse.json(
      { assigned, alreadyAssigned: tests.length - assigned, otherGrade: 0, notPublished },
      { status: assigned > 0 ? 201 : 200 },
    );
  }

  const children = await prisma.user.findMany({
    where: { id: { in: childIds }, role: "CHILD", status: "ACTIVE" },
    select: { id: true, childProfile: { select: { grade: true } } },
  });

  if (children.length !== childIds.length) {
    return NextResponse.json(
      { error: { code: "INVALID_CHILDREN", message: "One or more children are missing or blocked." } },
      { status: 422 },
    );
  }

  const counts = await prisma.$transaction(async (transaction) => {
    const totals = { assigned: 0, alreadyAssigned: 0, otherGrade: 0 };
    for (const child of children) {
      for (const test of tests) {
        if (!test.grade || test.grade !== child.childProfile?.grade) {
          totals.otherGrade += 1;
          continue;
        }
        const existing = await transaction.assignment.findFirst({ where: { testId: test.id, childId: child.id, status: "ACTIVE" }, select: { id: true } });
        if (existing) {
          totals.alreadyAssigned += 1;
          continue;
        }
        await transaction.assignment.create({ data: { testId: test.id, childId: child.id } });
        totals.assigned += 1;
      }
    }
    return totals;
  });

  return NextResponse.json({ ...counts, notPublished }, { status: counts.assigned > 0 ? 201 : 200 });
}
