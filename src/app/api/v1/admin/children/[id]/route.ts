import { childProfileInclude, resolveChildSubjects } from "@/lib/subject-catalog";
import { isSubjectList } from "@/lib/subjects";
import bcrypt from "bcryptjs";
import { AccountStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, normalizeLogin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ChildUpdateBody = {
  displayName?: unknown;
  login?: unknown;
  grade?: unknown;
  subjects?: unknown;
  password?: unknown;
  status?: unknown;
};

type RouteContext = { params: Promise<{ id: string }> };

function publicChild(child: {
  id: string;
  login: string;
  status: string;
  createdAt: Date;
  childProfile: { displayName: string; grade: string; subjects: { subject: { slug: string } }[] } | null;
}) {
  return {
    id: child.id,
    login: child.login,
    status: child.status.toLowerCase(),
    displayName: child.childProfile?.displayName ?? null,
    grade: child.childProfile?.grade ?? null,
    createdAt: child.createdAt,
    subjects: child.childProfile?.subjects?.map((subject) => subject.subject.slug) ?? [],
  };
}

async function getChild(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "CHILD" },
    include: { childProfile: { include: childProfileInclude } },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const child = await getChild((await context.params).id);

  if (!child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ child: publicChild(child) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const id = (await context.params).id;
  const child = await getChild(id);

  if (!child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found." } },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => null)) as ChildUpdateBody | null;
  if (body?.subjects !== undefined && !isSubjectList(body.subjects)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid subject list." } }, { status: 400 });
  }
  const subjects = body?.subjects === undefined ? undefined : await resolveChildSubjects(body.subjects as string[], child.childProfile?.subjects.map((item) => item.subject.slug) ?? []);
  if (subjects === null) return NextResponse.json({ error: { message: "Unknown or archived subject." } }, { status: 422 });
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : undefined;
  const login = typeof body?.login === "string" ? normalizeLogin(body.login) : undefined;
  const grade = typeof body?.grade === "string" ? body.grade.trim() : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;
  const status: AccountStatus | undefined =
    body?.status === "active" ? AccountStatus.ACTIVE :
    body?.status === "blocked" ? AccountStatus.BLOCKED :
    undefined;

  if (
    displayName === "" ||
    login === "" ||
    grade === "" ||
    password === "" ||
    (password !== undefined && password.length < 8) ||
    (body?.status !== undefined && !status)
  ) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "One or more child fields are invalid." } },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id },
        data: {
          ...(login !== undefined ? { login } : {}),
          ...(password !== undefined ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });

      if (displayName !== undefined || grade !== undefined || subjects !== undefined) {
        await transaction.childProfile.update({
          where: { userId: id },
          data: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(grade !== undefined ? { grade } : {}),
          },
        });
      }

      if (subjects !== undefined) {
        await transaction.childSubject.deleteMany({ where: { childId: id, subjectId: { notIn: subjects.map((item) => item.subjectId) } } });
        for (const item of subjects) {
          await transaction.childSubject.upsert({
            where: { childId_subjectId: { childId: id, subjectId: item.subjectId } },
            create: { childId: id, ...item },
            update: { sortOrder: item.sortOrder },
          });
        }
      }

      return transaction.user.findUniqueOrThrow({
        where: { id },
        include: { childProfile: { include: childProfileInclude } },
      });
    });

    return NextResponse.json({ child: publicChild(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: { code: "LOGIN_TAKEN", message: "That username is already in use." } },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to update child." } },
      { status: 500 },
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

  const child = await getChild((await context.params).id);

  if (!child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Child not found." } },
      { status: 404 },
    );
  }

  await prisma.user.delete({ where: { id: child.id } });
  return new NextResponse(null, { status: 204 });
}
