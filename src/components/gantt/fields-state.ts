import type { GanttFields, GanttFieldValue } from "./types";

export type FieldDraft = { key: string; type: "string" | "number" | "boolean" | "null"; value: string };
export const toDraft = (fields: GanttFields = {}): FieldDraft[] => Object.entries(fields).map(([key, value]) => ({ key, type: value === null ? "null" : typeof value as FieldDraft["type"], value: String(value ?? "") }));

export function parseDraft(draft: FieldDraft[]): { fields: GanttFields; error?: never } | { error: string; fields?: never } {
  const entries: [string, GanttFieldValue][] = [];
  const keys = new Set<string>();
  for (const field of draft) {
    const key = field.key.trim();
    if (!key || keys.has(key)) return { error: "特征名称不能为空或重复" };
    keys.add(key);
    if (field.type === "number" && (!field.value.trim() || !Number.isFinite(Number(field.value)))) return { error: "请输入有效数字" };
    entries.push([key, field.type === "null" ? null : field.type === "boolean" ? field.value === "true" : field.type === "number" ? Number(field.value) : field.value]);
  }
  return { fields: Object.fromEntries(entries) };
}
