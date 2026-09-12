import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNameTaken, readSetFields } from "@/lib/test-sets";

type RouteContext = { params: Promise<{ id: string }> };

/** Renames a set or changes its description. */
export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { id } = await context.params;
  const fields = readSetFields(await request.json().catch(() => null), true);

  if (!fields.ok) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: fields.message } }, { status: 400 });
  }

  try {
    const updated = await prisma.testSet.updateMany({ where: { id }, data: fields.value });
    if (updated.count === 0) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Set not found." } }, { status: 404 });
    }
  } catch (error) {
    if (isNameTaken(error)) {
      return NextResponse.json({ error: { code: "SET_NAME_TAKEN", message: "A set with this name already exists." } }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}

/** Deletes a set. Its tests stay in the library and stay assigned — they are only no longer grouped. */
export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const deleted = await prisma.testSet.deleteMany({ where: { id: (await context.params).id } });

  if (deleted.count === 0) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Set not found." } }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
