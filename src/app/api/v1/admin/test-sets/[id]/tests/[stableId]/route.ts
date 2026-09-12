import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; stableId: string }> };

/** Puts a test (every version of `stableId`) into the set, moving it out of any other set. */
export async function PUT(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id, stableId } = await context.params;
  const [set, test, previous] = await Promise.all([
    prisma.testSet.findUnique({ where: { id }, select: { id: true } }),
    prisma.test.findFirst({ where: { stableId }, select: { id: true } }),
    prisma.testSetItem.findUnique({ where: { stableId }, select: { setId: true, set: { select: { name: true } } } }),
  ]);

  if (!set) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Set not found." } }, { status: 404 });
  }

  if (!test) {
    return NextResponse.json({ error: { code: "TEST_NOT_FOUND", message: "Test not found." } }, { status: 404 });
  }

  if (previous?.setId === id) {
    return NextResponse.json({ movedFrom: null });
  }

  await prisma.testSetItem.upsert({
    where: { stableId },
    create: { stableId, setId: id },
    update: { setId: id, addedAt: new Date() },
  });

  return NextResponse.json({ movedFrom: previous?.set.name ?? null });
}

/** Takes a test out of the set; the test itself and its assignments are untouched. */
export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id, stableId } = await context.params;
  const removed = await prisma.testSetItem.deleteMany({ where: { stableId, setId: id } });

  if (removed.count === 0) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "This test is not in the set." } }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
