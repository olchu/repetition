import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GroupBody = { name?: unknown; childIds?: unknown };

export async function GET() {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const groups = await prisma.group.findMany({
    include: {
      members: {
        include: { child: { include: { childProfile: true } } },
      },
      _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      status: group.status.toLowerCase(),
      memberCount: group.members.length,
      activeAssignmentCount: group._count.assignments,
      members: group.members.map((member) => ({
        id: member.child.id,
        displayName: member.child.childProfile?.displayName ?? member.child.login,
        grade: member.child.childProfile?.grade ?? null,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as GroupBody | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const childIds = Array.isArray(body?.childIds) && body.childIds.every((id) => typeof id === "string")
    ? [...new Set(body.childIds)]
    : [];

  if (!name || childIds.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "A group name and at least one child are required." } },
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

  try {
    const group = await prisma.group.create({
      data: { name, members: { create: childIds.map((childId) => ({ childId })) } },
      include: { _count: { select: { members: true } } },
    });
    return NextResponse.json({ group: { id: group.id, name: group.name, status: group.status.toLowerCase(), memberCount: group._count.members } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: { code: "GROUP_NAME_TAKEN", message: "A group with that name already exists." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to create group." } },
      { status: 500 },
    );
  }
}
