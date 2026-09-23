import type { ILink, ITask } from "@svar-ui/react-gantt";
import type { GanttEdgeData, GanttId, GanttTaskData } from "./types";

type InternalTask = ITask & { $businessFields?: GanttTaskData["fields"] };
type InternalLink = ILink & {
  $businessName?: string;
  $businessFields?: GanttEdgeData["fields"];
};

export function toSvarTasks(taskData: GanttTaskData[]): ITask[] {
  return taskData.map((task) => ({
    id: task.id,
    text: task.name,
    type: task.type,
    start: toDate(task.start),
    end: toDate(task.end),
    ...(task.progress === undefined ? {} : { progress: task.progress }),
    ...(task.parent_id === undefined ? {} : { parent: task.parent_id }),
    ...(task.open === undefined ? {} : { open: task.open }),
    ...(task.fields === undefined ? {} : { $businessFields: { ...task.fields } }),
  }));
}

export function toSvarLinks(edgeData: GanttEdgeData[]): ILink[] {
  return edgeData.map((edge) => ({
    id: edge.id,
    type: edge.type as ILink["type"],
    source: edge.source_id,
    target: edge.target_id,
    ...(edge.lag === undefined ? {} : { lag: edge.lag }),
    ...(edge.name === undefined ? {} : { $businessName: edge.name }),
    ...(edge.fields === undefined ? {} : { $businessFields: { ...edge.fields } }),
  }));
}

export function fromSvarTasks(
  tasks: ITask[],
  original: GanttTaskData[],
): GanttTaskData[] {
  const originals = new Map(original.map((task) => [key(task.id), task]));
  return tasks.map((task) => {
    const previous = originals.get(key(task.id));
    const internal = task as InternalTask;
    return {
      id: task.id as GanttId,
      name: task.text ?? previous?.name ?? "",
      type: task.type ?? previous?.type ?? "task",
      start: task.start ?? previous?.start ?? new Date(0),
      end: task.end ?? previous?.end ?? new Date(0),
      ...(task.progress === undefined ? {} : { progress: task.progress }),
      ...(task.parent === undefined || (task.parent === 0 && previous?.parent_id === undefined)
        ? {}
        : { parent_id: task.parent as GanttId }),
      ...(task.open === undefined ? {} : { open: task.open }),
      ...(internal.$businessFields === undefined && previous?.fields === undefined
        ? {}
        : { fields: { ...(previous?.fields ?? {}), ...(internal.$businessFields ?? {}) } }),
    };
  });
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
        : { fields: { ...(previous?.fields ?? {}), ...(internal.$businessFields ?? {}) } }),
    };
  });
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function key(value: GanttId | undefined): string {
  return `${typeof value}:${String(value)}`;
}
