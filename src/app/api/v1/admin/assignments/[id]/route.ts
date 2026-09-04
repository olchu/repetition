import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const updated = await prisma.assignment.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Active assignment not found." } },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
