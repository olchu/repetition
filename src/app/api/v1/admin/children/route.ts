import { isSubjectList } from "@/lib/subjects";
import type { Subject } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, normalizeLogin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateChildBody = {
  displayName?: unknown;
  login?: unknown;
  grade?: unknown;
  subjects?: unknown;
  password?: unknown;
};

function publicChild(child: {
  id: string;
  login: string;
  status: string;
  createdAt: Date;
  childProfile: { displayName: string; grade: string; subjects: Subject[] } | null;
}) {
  return {
    id: child.id,
    login: child.login,
    status: child.status.toLowerCase(),
    displayName: child.childProfile?.displayName ?? null,
    grade: child.childProfile?.grade ?? null,
    createdAt: child.createdAt,
    subjects: child.childProfile?.subjects?.map((subject) => subject.toLowerCase()) ?? [],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim();
  const grade = searchParams.get("grade")?.trim();
  const status = searchParams.get("status")?.toUpperCase();

  const children = await prisma.user.findMany({
    where: {
      role: "CHILD",
      ...(status === "ACTIVE" || status === "BLOCKED" ? { status } : {}),
      childProfile: {
        is: {
          ...(search ? { displayName: { contains: search, mode: "insensitive" } } : {}),
          ...(grade ? { grade } : {}),
        },
      },
    },
    include: { childProfile: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ children: children.map(publicChild) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as CreateChildBody | null;
  if (body?.subjects !== undefined && !isSubjectList(body.subjects)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid subject list." } }, { status: 400 });
  }
  const subjects = body?.subjects === undefined ? undefined : (body.subjects as string[]).map((subject) => subject.toUpperCase() as Subject);
  const login = typeof body?.login === "string" ? normalizeLogin(body.login) : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const grade = typeof body?.grade === "string" ? body.grade.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!login || !displayName || !grade || password.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Display name, login, grade, and an 8-character password are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const child = await prisma.user.create({
      data: {
        role: "CHILD",
        login,
        passwordHash,
        childProfile: { create: { displayName, grade, subjects: subjects ?? [] } },
      },
      include: { childProfile: true },
    });

    return NextResponse.json({ child: publicChild(child) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: { code: "LOGIN_TAKEN", message: "That username is already in use." } },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to create child." } },
      { status: 500 },
    );
  }
}
