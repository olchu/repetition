/** Subject IDs are shared by test imports, student assignments and the UI. */
export const subjects = {
  biology: { label: "Biology", icon: "/icons/biology.png", tone: "science" },
  chemistry: { label: "Chemistry", icon: "/icons/chemistry.png", tone: "science" },
  geography: { label: "Geography", icon: "/icons/geography.png", tone: "geography" },
  ict: { label: "ICT", icon: "/icons/ict.png", tone: "mathematics" },
  mathematics: { label: "Mathematics", icon: "/icons/math.png", tone: "mathematics" },
  physics: { label: "Physics", icon: "/icons/phisics.png", tone: "science" },
  psychology: { label: "Psychology", icon: "/icons/psychology.png", tone: "history" },
  sociology: { label: "Sociology", icon: "/icons/sociology.png", tone: "history" },
  spanish: { label: "Spanish", icon: "/icons/spain.png", tone: "geography" },
  // Retained for existing tests; no dedicated artwork has been supplied.
  science: { label: "Science", icon: null, tone: "science" },
  history: { label: "History", icon: null, tone: "history" },
} as const;

export type SubjectId = keyof typeof subjects;
export const subjectIds = Object.keys(subjects) as SubjectId[];
export const subjectLabels: Record<string, string> = Object.fromEntries(
  subjectIds.map((id) => [id, subjects[id].label]),
);
export function isSubjectId(value: unknown): value is SubjectId {
  return typeof value === "string" && Object.hasOwn(subjects, value);
}
export function isSubjectList(value: unknown): value is SubjectId[] {
  return Array.isArray(value) && value.every(isSubjectId) && new Set(value).size === value.length;
}
