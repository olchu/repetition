import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
type GroupUpdateBody = { name?: unknown; childIds?: unknown; status?: unknown };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as GroupUpdateBody | null;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const childIds = Array.isArray(body?.childIds) && body.childIds.every((childId) => typeof childId === "string")
    ? [...new Set(body.childIds)]
    : undefined;
  const status = body?.status === "active" ? "ACTIVE" : body?.status === "blocked" ? "BLOCKED" : undefined;

  if (name === "" || (body?.status !== undefined && !status)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "One or more group fields are invalid." } },
      { status: 400 },
    );
  }

  if (childIds !== undefined) {
    if (childIds.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Groups must have at least one child." } },
        { status: 400 },
      );
    }
    const children = await prisma.user.findMany({
      where: { id: { in: childIds }, role: "CHILD", status: "ACTIVE" },
      select: { id: true },
    });
    if (children.length !== childIds.length) {
      return NextResponse.json(
        { error: { code: "INVALID_CHILDREN", message: "One or more children are missing or blocked." } },
        { status: 422 },
      );
    }
  }

  try {
    const group = await prisma.$transaction(async (transaction) => {
      await transaction.group.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });
      if (childIds !== undefined) {
        await transaction.groupMember.deleteMany({ where: { groupId: id } });
        await transaction.groupMember.createMany({ data: childIds.map((childId) => ({ groupId: id, childId })) });
      }
      return transaction.group.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { members: true } } },
      });
    });
    return NextResponse.json({ group: { id: group.id, name: group.name, status: group.status.toLowerCase(), memberCount: group._count.members } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: { code: "GROUP_NAME_TAKEN", message: "A group with that name already exists." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found or could not be updated." } },
      { status: 404 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const updated = await prisma.group.updateMany({
    where: { id: (await context.params).id, status: "ACTIVE" },
    data: { status: "BLOCKED" },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Active group not found." } },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
