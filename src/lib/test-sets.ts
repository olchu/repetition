import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Test sets: the administrator's named groups of tests; see docs/TEST-SETS.md. */

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

type SetFields = { name?: string; description?: string | null };

/** Reads a create (`partial` false: name required) or update body. */
export function readSetFields(body: unknown, partial: boolean): { ok: true; value: SetFields } | { ok: false; message: string } {
  const record = (body && typeof body === "object" ? body : {}) as { name?: unknown; description?: unknown };
  const value: SetFields = {};

  if (record.name !== undefined || !partial) {
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, message: `A set name of 1–${MAX_NAME_LENGTH} characters is required.` };
    value.name = name;
  }

  if (record.description !== undefined) {
    if (record.description !== null && typeof record.description !== "string") return { ok: false, message: "The description must be text." };
    const description = typeof record.description === "string" ? record.description.trim() : "";
    if (description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, message: `The description can be at most ${MAX_DESCRIPTION_LENGTH} characters.` };
    value.description = description || null;
  }

  return { ok: true, value };
}

export function isNameTaken(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The newest published version of each test, by stableId: what assigning a set hands out. */
export async function newestPublishedTests(stableIds: readonly string[]) {
  const tests = await prisma.test.findMany({
    where: { stableId: { in: [...stableIds] }, status: "PUBLISHED" },
    select: { id: true, stableId: true, version: true, grade: true },
    orderBy: { version: "desc" },
  });
  const newest = new Map<string, (typeof tests)[number]>();
  for (const test of tests) {
    if (!newest.has(test.stableId)) newest.set(test.stableId, test);
  }
  return newest;
}

/** Every set with its tests, for the administrator. The newest version of a test,
 *  whatever its status, supplies the title; `publishedTestId` is what assigning
 *  would hand out, or null while nothing is published. */
export async function loadTestSets() {
  const sets = await prisma.testSet.findMany({ include: { items: { orderBy: { addedAt: "asc" } } } });
  const versions = await prisma.test.findMany({
    where: { stableId: { in: sets.flatMap((set) => set.items.map((item) => item.stableId)) } },
    select: { id: true, stableId: true, version: true, title: true, grade: true, status: true, questionCount: true, subject: { select: { slug: true } } },
    orderBy: { version: "desc" },
  });
  const newest = new Map<string, (typeof versions)[number]>();
  const newestPublished = new Map<string, string>();
  for (const test of versions) {
    if (!newest.has(test.stableId)) newest.set(test.stableId, test);
    if (test.status === "PUBLISHED" && !newestPublished.has(test.stableId)) newestPublished.set(test.stableId, test.id);
  }

  return sets
    .map((set) => ({
      id: set.id,
      name: set.name,
      description: set.description,
      tests: set.items.flatMap((item) => {
        const test = newest.get(item.stableId);
        return test
          ? [{
              stableId: item.stableId,
              title: test.title,
              subject: test.subject.slug,
              grade: test.grade,
              version: test.version,
              status: test.status.toLowerCase(),
              questionCount: test.questionCount,
              publishedTestId: newestPublished.get(item.stableId) ?? null,
            }]
          : [];
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
