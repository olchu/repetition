import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNameTaken, loadTestSets, readSetFields } from "@/lib/test-sets";

export async function GET() {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  return NextResponse.json({ sets: await loadTestSets() });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const fields = readSetFields(await request.json().catch(() => null), false);

  if (!fields.ok) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: fields.message } }, { status: 400 });
  }

  const { name = "", description = null } = fields.value;

  try {
    const set = await prisma.testSet.create({ data: { name, description } });
    return NextResponse.json({ set: { id: set.id, name: set.name, description: set.description, tests: [] } }, { status: 201 });
  } catch (error) {
    if (isNameTaken(error)) {
      return NextResponse.json({ error: { code: "SET_NAME_TAKEN", message: "A set with this name already exists." } }, { status: 409 });
    }
    throw error;
  }
}
