export type SubjectRecord = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string;
  backgroundColor: string;
  textColor: string;
  sortOrder: number;
  archived: boolean;
};

export function isSubjectList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    && new Set(value).size === value.length;
}

export function parseSubject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const { slug, name, icon, color, backgroundColor, textColor, sortOrder, archived } = data;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100
    || typeof name !== "string" || !name.trim() || name.trim().length > 100
    || ![color, backgroundColor, textColor].every((value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value))
    || (icon !== null && (typeof icon !== "string" || !/^\/icons\/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg|svg)$/.test(icon)))
    || typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000
    || typeof archived !== "boolean") return null;
  return { slug, name: name.trim(), icon: icon as string | null, color: color as string,
    backgroundColor: backgroundColor as string, textColor: textColor as string, sortOrder, archived };
}
