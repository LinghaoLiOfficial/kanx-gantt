import type { GanttFields } from "./types";

export type FieldDraft = { key: string; value: string };
export const OWNER_FIELD = "负责人";
const fieldOrder = new WeakMap<object, string[]>();

function keysInFieldOrder(fields: object): string[] {
  return fieldOrder.get(fields) ?? Reflect.ownKeys(fields).filter((key): key is string => typeof key === "string");
}

function setField(fields: GanttFields, key: string, value: string) {
  Object.defineProperty(fields, key, { value, enumerable: true, configurable: true, writable: true });
}

/** Converts legacy scalar field values to the string-only business format. */
export function normalizeFields(fields: unknown): GanttFields {
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return {};
  // Object property enumeration moves integer-like keys ahead of other keys.
  // Field order is part of the editor UX, so preserve the source's explicit
  // insertion order when normalizing values.
  const normalized: GanttFields = {};
  const keys = keysInFieldOrder(fields);
  for (const key of keys) setField(normalized, key, String((fields as Record<string, unknown>)[key]));
  fieldOrder.set(normalized, keys);
  return normalized;
}

/** Normalizes task fields and guarantees the built-in owner feature exists. */
export function normalizeTaskFields(fields: unknown): GanttFields {
  const normalized = normalizeFields(fields);
  const ownerValue = Object.prototype.hasOwnProperty.call(normalized, OWNER_FIELD) ? normalized[OWNER_FIELD] : "";
  const withoutOwner: GanttFields = {};
  const remainingKeys = keysInFieldOrder(normalized).filter((key) => key !== OWNER_FIELD);
  for (const key of remainingKeys) setField(withoutOwner, key, normalized[key]);
  fieldOrder.set(withoutOwner, remainingKeys);
  return prependField(withoutOwner, OWNER_FIELD, ownerValue);
}

export const toDraft = (fields?: unknown): FieldDraft[] => {
  const normalized = normalizeFields(fields);
  return keysInFieldOrder(normalized).map((key) => ({ key, value: normalized[key] }));
};
export const toTaskDraft = (fields?: unknown): FieldDraft[] => {
  const normalized = normalizeTaskFields(fields);
  return keysInFieldOrder(normalized).map((key) => ({ key, value: normalized[key] }));
};

export function parseDraft(draft: FieldDraft[]): { fields: GanttFields; error?: never } | { error: string; fields?: never } {
  const entries: [string, string][] = [];
  const keys = new Set<string>();
  for (const field of draft) {
    const key = field.key.trim();
    if (!key || keys.has(key)) return { error: "特征名称不能为空或重复" };
    keys.add(key);
    entries.push([key, String(field.value)]);
  }
  return { fields: appendEntries(entries) };
}

function prependField(fields: GanttFields, key: string, value: string): GanttFields {
  const result: GanttFields = {};
  const keys = [key, ...keysInFieldOrder(fields)];
  setField(result, key, value);
  for (const existing of keysInFieldOrder(fields)) setField(result, existing, fields[existing]);
  fieldOrder.set(result, keys);
  return result;
}

function appendEntries(entries: [string, string][]): GanttFields {
  const result: GanttFields = {};
  const keys: string[] = [];
  for (const [key, value] of entries) { setField(result, key, value); keys.push(key); }
  fieldOrder.set(result, keys);
  return result;
}
