import type { ILink, ITask } from "@svar-ui/react-gantt";
import type { GanttEdgeData, GanttId, GanttTaskData } from "./types";

type InternalTask = ITask & { $businessFields?: GanttTaskData["fields"] };
type InternalLink = ILink & {
  $businessName?: string;
  $businessFields?: GanttEdgeData["fields"];
};

export type SvarTaskProjectionOptions = {
  summaryEndAtMilestoneIds?: Set<GanttId>;
};

export function toSvarTasks(taskData: GanttTaskData[], options: SvarTaskProjectionOptions = {}): ITask[] {
  const summaryEndAtMilestoneIds = options.summaryEndAtMilestoneIds;
  return taskData.map((task) => ({
    id: task.id,
    text: task.name,
    type: task.type,
    start: toDate(task.start),
    end: toSvarEnd(task, summaryEndAtMilestoneIds),
    ...(task.progress === undefined ? {} : { progress: task.progress }),
    ...(task.parent_id === undefined ? {} : { parent: task.parent_id }),
    ...(task.open === undefined ? {} : { open: task.open }),
    ...(task.fields === undefined ? {} : { $businessFields: normalizeFields(task.fields) }),
  }));
}

function toSvarEnd(task: GanttTaskData, summaryEndAtMilestoneIds?: Set<GanttId>): Date {
  const end = toDate(task.end);
  if (task.type !== "summary" || !summaryEndAtMilestoneIds?.has(task.id)) return end;
  const start = toDate(task.start);
  // SVAR treats an end date as an inclusive day for summary bars, while a
  // milestone is drawn at the date's center. Move only the chart projection
  // back one day so the summary's visual right edge meets that center. The
  // business snapshot keeps the original envelope date.
  if (end.getTime() > start.getTime()) end.setDate(end.getDate() - 1);
  return end;
}

export function toSvarLinks(edgeData: GanttEdgeData[]): ILink[] {
  return edgeData.map((edge) => ({
    id: edge.id,
    type: edge.type as ILink["type"],
    source: edge.source_id,
    target: edge.target_id,
    ...(edge.lag === undefined ? {} : { lag: edge.lag }),
    ...(edge.name === undefined ? {} : { $businessName: edge.name }),
    ...(edge.fields === undefined ? {} : { $businessFields: normalizeFields(edge.fields) }),
  }));
}

export function fromSvarTasks(
  tasks: ITask[],
  original: GanttTaskData[],
  options: SvarTaskProjectionOptions = {},
): GanttTaskData[] {
  const originals = new Map(original.map((task) => [key(task.id), task]));
  return tasks.map((task) => {
    const previous = originals.get(key(task.id));
    const internal = task as InternalTask;
    const end = task.end ?? previous?.end ?? new Date(0);
    const type = task.type ?? previous?.type ?? "task";
    return {
      id: task.id as GanttId,
      name: task.text ?? previous?.name ?? "",
      type,
      start: task.start ?? previous?.start ?? new Date(0),
      end: type === "summary" && options.summaryEndAtMilestoneIds?.has(task.id as GanttId)
        ? addLocalDay(end)
        : end,
      ...(task.progress === undefined ? {} : { progress: task.progress }),
      // SVAR normalizes a flat/root row to parent=0. That sentinel must not
      // overwrite a stable business parent recovered from the source snapshot.
      ...(task.parent !== undefined && task.parent !== 0
        ? { parent_id: task.parent as GanttId }
        : previous?.parent_id === undefined ? {} : { parent_id: previous.parent_id }),
      ...(task.open === undefined ? {} : { open: task.open }),
      ...(internal.$businessFields === undefined && previous?.fields === undefined
        ? {}
        : { fields: normalizeFields(internal.$businessFields ?? previous?.fields) }),
    };
  });
}

function addLocalDay(value: string | Date): Date {
  const date = toDate(value);
  date.setDate(date.getDate() + 1);
  return date;
}

export function fromSvarLinks(
  links: ILink[],
  original: GanttEdgeData[],
): GanttEdgeData[] {
  const originals = new Map(original.map((edge) => [key(edge.id), edge]));
  return links.map((link) => {
    const previous = originals.get(key(link.id));
    const internal = link as InternalLink;
    return {
      id: link.id as GanttId,
      ...(internal.$businessName ?? previous?.name
        ? { name: internal.$businessName ?? previous?.name }
        : {}),
      type: link.type,
      source_id: link.source as GanttId,
      target_id: link.target as GanttId,
      ...(link.lag === undefined ? {} : { lag: link.lag }),
      ...(internal.$businessFields === undefined && previous?.fields === undefined
        ? {}
        : { fields: normalizeFields(internal.$businessFields ?? previous?.fields) }),
    };
  });
}

function toDate(value: string | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function key(value: GanttId | undefined): string {
  return `${typeof value}:${String(value)}`;
}

function normalizeFields(fields: unknown): Record<string, string> {
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return {};
  const normalized: Record<string, string> = {};
  for (const name of Reflect.ownKeys(fields)) {
    if (typeof name !== "string") continue;
    normalized[name] = String((fields as Record<string, unknown>)[name]);
  }
  return normalized;
}
