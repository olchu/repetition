import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { readdir } from "node:fs/promises";
import path from "node:path";

export async function subjectIcons() {
  const files = await readdir(path.join(process.cwd(), "public", "icons"), { withFileTypes: true });
  return files.filter((file) => file.isFile() && /^[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg|svg)$/.test(file.name))
    .map((file) => "/icons/" + file.name).sort();
}

export const childProfileInclude = {
  subjects: { include: { subject: true }, orderBy: [{ sortOrder: "asc" }, { subjectId: "asc" }] },
} satisfies Prisma.ChildProfileInclude;

// Archived subjects can be retained in existing assignments, but not newly assigned.
export async function resolveChildSubjects(slugs: string[], existing: string[] = []) {
  const records = await prisma.subject.findMany({ where: { slug: { in: slugs } } });
  if (records.length !== slugs.length || records.some((subject) => subject.archived && !existing.includes(subject.slug))) return null;
  return slugs.map((slug, sortOrder) => ({ subjectId: records.find((subject) => subject.slug === slug)!.id, sortOrder }));
}
