import type { GanttEdgeData, GanttId, GanttTaskData } from "./types";

export const idKey = (id: GanttId) => `${typeof id}:${id}`;
export const DETAIL_PREFIX = "__kanx_detail:";
export const DEFAULT_GRID_WIDTH = 380;

export const yearOptions = (year: number): number[] => [year + 1, year, year - 1];
export const canCreateChild = (task: GanttTaskData): boolean => task.parent_id === undefined;

export function firstTaskDate(tasks: GanttTaskData[], year: number): Date {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  let earliest = yearEnd;
  for (const task of tasks) {
    const start = toLocalDay(task.start);
    const end = toLocalDay(task.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < yearStart || start >= yearEnd) continue;
    const visibleStart = start < yearStart ? yearStart : start;
    if (visibleStart < earliest) earliest = visibleStart;
  }
  return earliest === yearEnd ? yearStart : earliest;
}

function toLocalDay(value: string | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function descendants(tasks: GanttTaskData[], id: GanttId): Set<GanttId> {
  const found = new Set<GanttId>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (task.parent_id !== undefined && found.has(task.parent_id) && !found.has(task.id)) {
        found.add(task.id);
        changed = true;
      }
    }
  }
  return found;
}

export function summariesEndingAtMilestone(tasks: GanttTaskData[]): Set<GanttId> {
  const result = new Set<GanttId>();
  const byId = new Map(tasks.map((task) => [idKey(task.id), task]));
  for (const task of tasks) {
    if (task.type !== "summary") continue;
    const terminalMilestone = [...descendants(tasks, task.id)]
      .filter((id) => id !== task.id)
      .map((id) => byId.get(idKey(id)))
      .some((child) => child?.type === "milestone" && sameLocalDay(child.start, task.end));
    if (terminalMilestone) result.add(task.id);
  }
  return result;
}

function sameLocalDay(left: string | Date, right: string | Date): boolean {
  const a = toLocalDay(left);
  const b = toLocalDay(right);
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a.getTime() === b.getTime();
}

export function removeSubtree(tasks: GanttTaskData[], edges: GanttEdgeData[], id: GanttId) {
  const removed = descendants(tasks, id);
  return {
    taskData: tasks.filter((task) => !removed.has(task.id)),
    edgeData: edges.filter((edge) => !removed.has(edge.source_id) && !removed.has(edge.target_id)),
  };
}

export type VisibleTask = { task: GanttTaskData; depth: number; detailRows: number };
export function visibleTasks(tasks: GanttTaskData[], expanded: Set<string>, detailRows: (task: GanttTaskData) => number): VisibleTask[] {
  const result: VisibleTask[] = [];
  const visited = new Set<GanttId>();
  const ids = new Set(tasks.map((task) => task.id));
  const walk = (task: GanttTaskData, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    result.push({ task, depth, detailRows: expanded.has(idKey(task.id)) ? detailRows(task) : 0 });
    if (task.open !== false) tasks.filter((child) => child.parent_id === task.id).forEach((child) => walk(child, depth + 1));
  };
  tasks.filter((task) => task.parent_id === undefined || !ids.has(task.parent_id)).forEach((task) => walk(task, 0));
  return result;
}

export type TaskDragMode = "move" | "start" | "end";

export function dragTask(tasks: GanttTaskData[], id: GanttId, mode: TaskDragMode, days: number): GanttTaskData[] {
  const original = tasks.find((task) => task.id === id);
  if (!original || !days) return tasks;
  const shift = (value: string | Date) => { const date = toLocalDay(value); date.setDate(date.getDate() + days); return date; };
  const branch = descendants(tasks, id);
  const children = tasks.filter((task) => task.id !== id && branch.has(task.id));
  let start = mode === "end" ? toLocalDay(original.start) : shift(original.start);
  let end = mode === "start" ? toLocalDay(original.end) : shift(original.end);
  if (mode === "start") start = new Date(Math.min(start.getTime(), end.getTime(), ...children.map((task) => toLocalDay(task.start).getTime())));
  if (mode === "end") end = new Date(Math.max(end.getTime(), start.getTime(), ...children.map((task) => toLocalDay(task.end).getTime())));
  if (sameLocalDay(start, original.start) && sameLocalDay(end, original.end)) return tasks;
  const typeFor = (task: GanttTaskData, a: Date, b: Date) => a.getTime() === b.getTime() ? "milestone" : task.type === "milestone" ? (tasks.some((child) => child.parent_id === task.id) ? "summary" : "task") : task.type;
  const result = tasks.map((task) => {
    if (task.id === id) return { ...task, start, end, type: typeFor(task, start, end) };
    if (mode === "move" && branch.has(task.id)) return { ...task, start: shift(task.start), end: shift(task.end) };
    return task;
  });
  const byId = new Map(result.map((task) => [task.id, task]));
  let child = byId.get(id);
  const visited = new Set<GanttId>([id]);
  while (child?.parent_id !== undefined && !visited.has(child.parent_id)) {
    const parent = byId.get(child.parent_id);
    if (!parent) break;
    visited.add(parent.id);
    const family = descendants(result, parent.id);
    const members = result.filter((task) => family.has(task.id));
    start = new Date(Math.min(...members.map((task) => toLocalDay(task.start).getTime())));
    end = new Date(Math.max(...members.map((task) => toLocalDay(task.end).getTime())));
    if (!sameLocalDay(parent.start, start) || !sameLocalDay(parent.end, end)) {
      const expanded = { ...parent, start, end, type: typeFor(parent, start, end) };
      result[result.indexOf(parent)] = expanded;
      byId.set(parent.id, expanded);
      child = expanded;
    } else child = parent;
  }
  return result;
}

export function applyChartUpdates(tasks: GanttTaskData[], updates: GanttTaskData[]): GanttTaskData[] {
  // Date gestures use dragTask with an explicit mode. Native events are kept
  // for progress only; native summary rollups must never change business dates.
  const byId = new Map(updates.map((task) => [idKey(task.id), task]));
  return tasks.map((task) => {
    const update = byId.get(idKey(task.id));
    return update?.progress === undefined ? task : { ...task, progress: update.progress };
  });
}
