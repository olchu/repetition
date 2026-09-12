"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { parseSubject, type SubjectRecord } from "@/lib/subjects";

const SubjectsContext = createContext<{ subjects: SubjectRecord[]; icons: string[]; refresh: () => Promise<void> } | null>(null);

export function SubjectsProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<SubjectRecord[] | null>(null);
  const [icons, setIcons] = useState<string[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/v1/subjects", { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "Please sign in to continue." : "Unable to load subjects.");
    const payload = await response.json() as { subjects: SubjectRecord[]; icons: string[] };
    setSubjects(payload.subjects);
    setIcons(payload.icons);
    setError("");
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void refresh().catch((reason: Error) => setError(reason.message)); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  if (error) return <main style={{ padding: 32 }}><p role="alert">{error}</p><button onClick={() => void refresh().catch((reason: Error) => setError(reason.message))}>Try again</button> <Link href="/">Sign in</Link></main>;
  if (!subjects) return <main style={{ padding: 32 }}>Loading subjects…</main>;
  // Values are validated before insertion into CSS; no arbitrary styles are accepted.
  const palette = subjects.filter((subject) => parseSubject(subject)).map((subject) =>
    `[data-subject="${subject.slug}"]{--tone:${subject.color};--tone-ink:${subject.textColor};--tone-soft:${subject.backgroundColor};--subject-ink:${subject.textColor};--subject-soft:${subject.backgroundColor};}`
  ).join("\n");
  return <SubjectsContext.Provider value={{ subjects, icons, refresh }}><style>{palette}</style>{children}</SubjectsContext.Provider>;
}

export function useSubjects() {
  const context = useContext(SubjectsContext);
  if (!context) throw new Error("SubjectsProvider is required.");
  const subjectLabels = Object.fromEntries(context.subjects.map((subject) => [subject.slug, subject.name]));
  return { ...context, subjectLabels };
}

export function useSubjectLabel() {
  const { subjectLabels } = useSubjects();
  return (slug: string) => subjectLabels[slug] ?? slug;
}
