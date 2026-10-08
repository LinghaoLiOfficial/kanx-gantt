"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Gantt, Willow, type IApi, type ILink, type ITask } from "@svar-ui/react-gantt";
import { CircleHelp, GripVertical, Plus, X } from "lucide-react";
import "@svar-ui/react-gantt/all.css";
import "./gantt.css";
import { cn } from "../../lib/utils";
import { fromSvarLinks, toSvarLinks, toSvarTasks } from "./adapter";
import { FieldsEditor } from "./fields-editor";
import { normalizeFields, normalizeTaskFields, toTaskDraft, type FieldDraft } from "./fields-state";
import { Tooltip, TooltipContent, type TooltipAnchorRect } from "../ui/tooltip";
import { applyChartUpdates, canCreateChild, DEFAULT_GRID_WIDTH, descendants, DETAIL_PREFIX, dragTask, idKey, insertTask, openingDate, removeSubtree, reorderTasks, visibleTasks, yearOptions, type TaskDragMode, type TaskDropPosition } from "./task-state";
import { TaskCreateDialog, type TaskCreateValues } from "./task-create-dialog";
import type { GanttEdgeData, GanttEdgeRenderStyle, GanttId, GanttNativeProps, GanttSnapshot, GanttTaskData, GanttTaskRenderStyle } from "./types";

const subscribe = () => () => undefined;
const emptyEdges: GanttEdgeData[] = [];
const emptyTaskRenderers: Record<string, GanttTaskRenderStyle> = {};
const emptyEdgeRenderers: Record<string, GanttEdgeRenderStyle> = {};
const matchesChartId = (id: GanttId, chartId: string | undefined) => chartId === (typeof id === "string" ? `:${id}` : String(id));
export type SvarGanttProps = {
  taskData: GanttTaskData[]; edgeData?: GanttEdgeData[];
  taskRenderers?: Record<string, GanttTaskRenderStyle>; edgeRenderers?: Record<string, GanttEdgeRenderStyle>;
  showDependencyArrows?: boolean; onChange?: (snapshot: GanttSnapshot) => void;
  selectedYear?: number; onYearChange?: (year: number) => void;
  nativeProps?: GanttNativeProps; className?: string;
};
type NativeGanttProps = Omit<ComponentProps<typeof Gantt>, "tasks" | "links" | "init">;
const chartScales: NonNullable<NativeGanttProps["scales"]> = [{ unit: "month", step: 1, format: "%Y 年 %m 月" }, { unit: "day", step: 1, format: "%d 日" }];
const emptyColumns: NonNullable<NativeGanttProps["columns"]> = [];
const emptyLinks: ILink[] = [];
const normalizeSnapshot = (taskData: GanttTaskData[], edgeData: GanttEdgeData[]): GanttSnapshot => ({
  taskData: taskData.map((task) => ({ ...task, fields: normalizeTaskFields(task.fields) })),
  edgeData: edgeData.map((edge) => edge.fields === undefined ? edge : { ...edge, fields: normalizeFields(edge.fields) }),
});

function TreeMarker({ depth, hasChildren, open, name, onToggle }: { depth: number; hasChildren: boolean; open?: boolean; name: string; onToggle: () => void }) {
  if (!hasChildren) return <span className={`kanx-tree ${depth > 0 ? "kanx-child-bullet" : ""}`} aria-hidden="true">{depth > 0 ? "•" : ""}</span>;
  return <button type="button" className="kanx-tree" aria-label={`${open === false ? "展开" : "收起"}子任务：${name}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>{open === false ? "▸" : "▾"}</button>;
}

function taskTypeLabel(type: string) {
  return type === "milestone" ? "节点" : "时段";
}

function taskDateLabel(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll("-", "/");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function taskDurationDays(start: string | Date, end: string | Date) {
  const toDay = (value: string | Date) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return Date.UTC(year, month - 1, day);
    }
    const date = new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  const duration = Math.floor((toDay(end) - toDay(start)) / 86400000) + 1;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function SvarGantt({ className, taskData, edgeData = emptyEdges, taskRenderers = emptyTaskRenderers, edgeRenderers = emptyEdgeRenderers, showDependencyArrows = false, onChange, selectedYear: controlledYear, onYearChange, nativeProps = {} }: SvarGanttProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const hostRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IApi | null>(null);
  const positionFrames = useRef<number[]>([]);
  const positionGeneration = useRef(0);
  const [renderApi, setRenderApi] = useState<IApi | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snapshot, setSnapshot] = useState<GanttSnapshot>(() => normalizeSnapshot(taskData, edgeData));
  const chartUpdating = useRef(false);
  const gesture = useRef<{ id: GanttId; mode: TaskDragMode; x: number; days: number; width: number; base: GanttSnapshot; previewTasks: GanttTaskData[]; pointerId: number } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const helpRef = useRef<HTMLButtonElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, FieldDraft[]>>({});
  const [editing, setEditing] = useState<{ id: GanttId; value: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const [deleting, setDeleting] = useState<GanttId | null>(null);
  const [creating, setCreating] = useState<GanttTaskData | null | undefined>(undefined);
  const dragSession = useRef<{ id: GanttId } | null>(null);
  const [dragTaskId, setDragTaskId] = useState<GanttId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: GanttId; position: TaskDropPosition } | null>(null);
  const [chartTooltip, setChartTooltip] = useState<{ content: string; anchorRect: TooltipAnchorRect } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(60);
  const [viewportHeight, setViewportHeight] = useState(0);
  const thisYear = new Date().getFullYear();
  const [internalYear, setInternalYear] = useState(thisYear);
  const selectedYear = controlledYear ?? internalYear;
  const readonly = Boolean(nativeProps.readonly);
  const rowHeight = Number(nativeProps.cellHeight ?? 44);
  const gridWidth = Number(nativeProps.gridWidth ?? DEFAULT_GRID_WIDTH);
  const draftFor = (task: GanttTaskData) => drafts[idKey(task.id)] ?? toTaskDraft(task.fields);
  const [inputs, setInputs] = useState({ taskData, edgeData });
  if (inputs.taskData !== taskData || inputs.edgeData !== edgeData) {
    setInputs({ taskData, edgeData });
    setSnapshot(normalizeSnapshot(taskData, edgeData));
  }
  const positionDataKey = useMemo(() => taskData.map((task) => [idKey(task.id), task.type, String(task.start), String(task.end), task.parent_id === undefined ? "" : idKey(task.parent_id)].join("|")).join(";"), [taskData]);
  const commit = (next: GanttSnapshot) => { current.current.snapshot = next; setSnapshot(next); onChange?.(next); };
  const update = (id: GanttId, patch: Partial<GanttTaskData>) => commit({ ...snapshot, taskData: snapshot.taskData.map((task) => task.id === id ? { ...task, ...patch } : task) });
  const current = useRef({ snapshot, commit, readonly, nativeProps, showDependencyArrows, selectedYear });
  useEffect(() => { current.current = { snapshot, commit, readonly, nativeProps, showDependencyArrows, selectedYear }; });
  const shownTasks = snapshot.taskData;
  const rows = useMemo(() => visibleTasks(shownTasks, expanded, (task) => {
    const fieldCount = (drafts[idKey(task.id)] ?? toTaskDraft(task.fields)).length;
    // Reserve one row for dates and one row for the empty editor's add control;
    // each existing feature uses one additional row.
    const detailContentHeight = 30 + 8 + (readonly ? 12 : 40) + fieldCount * 30;
    return Math.max(1, Math.ceil(detailContentHeight / rowHeight));
  }), [shownTasks, expanded, drafts, readonly, rowHeight]);
  const tasks = useMemo(() => toSvarTasks(rows.flatMap(({ task, detailRows }) => [
    // Business hierarchy is maintained here, not by SVAR's automatic rollups.
    { ...task, type: task.type === "summary" ? "task" : task.type, parent_id: undefined, open: undefined },
    ...Array.from({ length: detailRows }, (_, index) => ({ id: `${DETAIL_PREFIX}${idKey(task.id)}:${index}`, name: "", type: "task", start: task.start, end: task.start, progress: 0 })),
  ])), [rows]);
  const links = useMemo(() => {
    const ids = new Set(rows.map(({ task }) => task.id));
    return toSvarLinks(snapshot.edgeData.filter((edge) => ids.has(edge.source_id) && ids.has(edge.target_id)));
  }, [rows, snapshot.edgeData]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const schedulePosition = useCallback((api: IApi) => {
    const generation = ++positionGeneration.current;
    positionFrames.current.forEach((frame) => cancelAnimationFrame(frame));
    positionFrames.current = [];
    const run = () => {
      if (generation !== positionGeneration.current || apiRef.current !== api) return;
      api.exec("scroll-chart", { date: openingDate(current.current.snapshot.taskData, current.current.selectedYear) });
      positionFrames.current = [];
    };
    positionFrames.current.push(requestAnimationFrame(() => {
      positionFrames.current.push(requestAnimationFrame(run));
    }));
  }, []);
  const init = useCallback((api: IApi) => {
    cleanupRef.current?.(); apiRef.current = api; setRenderApi(api);
    // Wait for SVAR's scale and chart dimensions before positioning.
    schedulePosition(api);
    const tag = "kanx-business";
    const reactive = api.getReactiveState();
    // SVAR's public writable type declares void, but subscribe returns an unsubscribe function at runtime.
    const unscroll = reactive.scrollTop.subscribe((top) => { if (leftRef.current && Math.abs(leftRef.current.scrollTop - top) > 1) leftRef.current.scrollTop = top; }) as unknown as (() => void) | undefined;
    const unscale = reactive._scales?.subscribe((scales) => { if (scales) setHeaderHeight(scales.height); }) as unknown as (() => void) | undefined;
    const unheight = reactive._chartHeight?.subscribe((height) => { if (height) setViewportHeight(height); }) as unknown as (() => void) | undefined;
    api.intercept("delete-task", ({ id }: { id: GanttId }) => { if (!current.current.readonly && !String(id).startsWith(DETAIL_PREFIX)) setDeleting(id); return false; }, { tag });
    for (const action of ["move-task", "indent-task", "add-task", "copy-task"] as const) api.intercept(action, () => false, { tag });
    api.intercept("update-task", ({ id, task }: { id: GanttId; task?: Partial<ITask> }) => chartUpdating.current || (!current.current.readonly && !String(id).startsWith(DETAIL_PREFIX) && task?.progress !== undefined && task.start === undefined && task.end === undefined), { tag });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingUpdates = new Map<string, { id: GanttId; task?: Partial<ITask> }>();
    let linkTimer: ReturnType<typeof setTimeout> | undefined;
    api.on("update-task", (event: { id?: GanttId; task?: Partial<ITask> }) => {
      if (chartUpdating.current || event.task?.progress === undefined) return;
      if (event.id !== undefined) pendingUpdates.set(idKey(event.id), { id: event.id, task: event.task });
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { snapshot: previous, commit: save } = current.current;
        const updates = [...pendingUpdates.values()].flatMap(({ id, task }) => {
          const original = previous.taskData.find((item) => item.id === id);
          return original && task?.progress !== undefined ? [{ ...original, progress: task.progress }] : [];
        });
        pendingUpdates.clear();
        const updated = applyChartUpdates(previous.taskData, updates);
        save({ ...previous, taskData: updated });
      }, 0);
    }, { tag });
    for (const action of ["add-link", "update-link"] as const) api.intercept(action, ({ link }) => {
      if (current.current.readonly || !current.current.showDependencyArrows) return false;
      return ![link?.source, link?.target].some((id) => String(id).startsWith(DETAIL_PREFIX));
    }, { tag });
    for (const action of ["add-link", "update-link", "delete-link"] as const) api.on(action, () => {
      clearTimeout(linkTimer);
      linkTimer = setTimeout(() => {
      const { snapshot: previous, commit: save, showDependencyArrows: show } = current.current;
      if (!show) return;
      const ids = new Set((api.serialize({ data: "tasks" }) as ITask[]).map((task) => task.id));
      const hidden = previous.edgeData.filter((edge) => !ids.has(edge.source_id) || !ids.has(edge.target_id));
      save({ taskData: previous.taskData, edgeData: [...hidden, ...fromSvarLinks(api.serialize({ data: "links" }) as ILink[], previous.edgeData)] });
      }, 0);
    }, { tag });
    const nativeInit = current.current.nativeProps.init;
    if (typeof nativeInit === "function") nativeInit(api);
    cleanupRef.current = () => { unscroll?.(); unscale?.(); unheight?.(); clearTimeout(timer); clearTimeout(linkTimer); pendingUpdates.clear(); api.detach(tag); };
  }, [schedulePosition]);
  useEffect(() => () => {
    cleanupRef.current?.();
    positionFrames.current.forEach((frame) => cancelAnimationFrame(frame));
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);
  useEffect(() => {
    const closeDetailsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(".kanx-detail") || target.closest(".kanx-task-row")) return;
      setExpanded((previous) => previous.size ? new Set() : previous);
    };
    document.addEventListener("pointerdown", closeDetailsOutside);
    return () => document.removeEventListener("pointerdown", closeDetailsOutside);
  }, []);
  useEffect(() => {
    let frame = 0;
    const preview = () => {
      frame = 0;
      const active = gesture.current;
      const api = apiRef.current;
      if (!active || !api) return;
      const next = dragTask(active.base.taskData, active.id, active.mode, active.days);
      chartUpdating.current = true;
      try {
        for (let index = 0; index < next.length; index++) {
          const task = next[index];
          if (task === active.previewTasks[index]) continue;
          const displayed = api.getTask(task.id);
          if (!displayed) continue; // Hidden descendants remain in the business snapshot.
          const projected = toSvarTasks([{ ...task, type: task.type === "summary" ? "task" : task.type, parent_id: undefined, open: undefined }])[0];
          if (displayed.start?.valueOf() === projected.start?.valueOf() && displayed.end?.valueOf() === projected.end?.valueOf() && displayed.type === projected.type) continue;
          api.exec("update-task", { id: task.id, task: { start: projected.start, end: projected.end, type: projected.type }, skipUndo: true });
        }
        active.previewTasks = next;
      } finally { chartUpdating.current = false; }
    };
    const move = (event: PointerEvent) => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const days = Math.round((event.clientX - active.x) / active.width);
      if (days === active.days) return;
      active.days = days;
      if (!frame) frame = requestAnimationFrame(preview);
    };
    const finish = (event: PointerEvent) => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      cancelAnimationFrame(frame); frame = 0;
      if (event.type === "pointercancel") active.days = 0;
      else active.days = Math.round((event.clientX - active.x) / active.width);
      preview();
      gesture.current = null;
      document.body.style.removeProperty("user-select");
      if (event.type !== "pointercancel" && active.days) {
        const taskData = dragTask(active.base.taskData, active.id, active.mode, active.days);
        if (taskData !== active.base.taskData) current.current.commit({ ...active.base, taskData });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); document.body.style.removeProperty("user-select"); };
  }, []);
  useEffect(() => { if (rulesOpen) rulesRef.current?.querySelector("button")?.focus(); }, [rulesOpen]);
  const closeRules = () => { setRulesOpen(false); helpRef.current?.focus(); };
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    schedulePosition(api);
  }, [schedulePosition, selectedYear]);
  const previousPositionDataKey = useRef(positionDataKey);
  useEffect(() => {
    if (previousPositionDataKey.current === positionDataKey) return;
    previousPositionDataKey.current = positionDataKey;
    if (apiRef.current) schedulePosition(apiRef.current);
  }, [positionDataKey, schedulePosition]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const tasksByChartId = new Map(snapshot.taskData.map((task) => [typeof task.id === "string" ? `:${task.id}` : String(task.id), task]));
    // Root tasks are parent-capable even before their first child is added;
    // summary tasks remain parents after children are removed.
    const parentIds = new Set(snapshot.taskData.filter((task) => task.parent_id === undefined || task.type === "summary").map((task) => idKey(task.id)));
    snapshot.taskData.forEach((task) => { if (task.parent_id !== undefined) parentIds.add(idKey(task.parent_id)); });
    const edgesByChartId = new Map(snapshot.edgeData.map((edge) => [String(edge.id), edge]));
    const applyStyles = () => {
      host.querySelectorAll<HTMLElement>(".wx-bar[data-id]").forEach((bar) => {
        const task = tasksByChartId.get(bar.dataset.id ?? "");
        const isParent = task ? parentIds.has(idKey(task.id)) : false;
        if (isParent) bar.dataset.kanxHierarchy = "parent";
        else delete bar.dataset.kanxHierarchy;
        // Apply this directly because the chart library may overwrite the
        // text styles after the bar is mounted. Summary tasks remain parents
        // even when they currently have no children.
        const taskText = bar.querySelector<HTMLElement>(".wx-text-out");
        if (taskText) taskText.style.fontWeight = isParent ? "700" : "";
        // Reuse SVAR's two circular endpoints. Do not add another handle or
        // interpret the task body's edges as a separate resize gesture.
        if (task) bar.querySelectorAll<HTMLElement>(".wx-link").forEach((handle) => {
          handle.title = `${handle.classList.contains("wx-left") ? "调整开始时间" : "调整结束时间"}：${task.name}`;
        });
        const progress = bar.querySelector<HTMLElement>(".wx-progress-marker");
        if (task && progress) progress.title = `调整进度：${task.name}`;
        const style = task && taskRenderers[task.type];
        if (isParent) {
          const outline = style?.borderColor ?? style?.barColor ?? getComputedStyle(bar).backgroundColor;
          if (outline) bar.style.setProperty("--kanx-parent-outline", outline);
        } else bar.style.removeProperty("--kanx-parent-outline");
        if (!style) return;
        const prefix = bar.classList.contains("wx-summary") ? "summary" : "task";
        for (const [key, value] of Object.entries({ color: style.barColor, "fill-color": style.progressColor, "font-color": style.fontColor, "border-color": style.borderColor })) if (value) bar.style.setProperty(`--wx-gantt-${prefix}-${key}`, value);
      });
      host.querySelectorAll<SVGElement>(".wx-line").forEach((line) => {
        const id = line.getAttribute("data-link-id") ?? line.getAttribute("data-id") ?? line.id;
        const edge = edgesByChartId.get(id);
        const style = edge && edgeRenderers[edge.type];
        if (!style) return;
        const path = line.querySelector(".wx-line-draw") ?? line;
        if (style.color) path.setAttribute("stroke", style.color);
        if (style.width !== undefined) path.setAttribute("stroke-width", String(style.width));
        if (style.dash) path.setAttribute("stroke-dasharray", style.dash);
      });
    };
    applyStyles(); const observer = new MutationObserver(applyStyles);
    observer.observe(host.querySelector(".kanx-chart") ?? host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [snapshot, taskRenderers, edgeRenderers, mounted, readonly]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const findAnchor = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const bar = element?.closest<HTMLElement>(".wx-bar[data-id]");
      if (!element || !bar) return null;
      const text = element.closest<HTMLElement>(".wx-text-out") ?? bar.querySelector<HTMLElement>(".wx-content");
      if (!text || text.scrollWidth <= text.clientWidth + 1) return null;
      const task = snapshot.taskData.find((item) => matchesChartId(item.id, bar.dataset.id));
      if (!task) return null;
      const rect = text.getBoundingClientRect();
      return { content: task.name, anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } };
    };
    const over = (event: MouseEvent) => {
      const anchor = findAnchor(event.target);
      setChartTooltip(anchor);
    };
    const out = (event: MouseEvent) => {
      if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) setChartTooltip(null);
    };
    const focus = (event: FocusEvent) => { const anchor = findAnchor(event.target); if (anchor) setChartTooltip(anchor); };
    const blur = () => setChartTooltip(null);
    host.addEventListener("mouseover", over);
    host.addEventListener("mouseout", out);
    host.addEventListener("focusin", focus);
    host.addEventListener("focusout", blur);
    return () => { host.removeEventListener("mouseover", over); host.removeEventListener("mouseout", out); host.removeEventListener("focusin", focus); host.removeEventListener("focusout", blur); };
  }, [snapshot.taskData]);
  const toggleDetails = (task: GanttTaskData) => {
    const key = idKey(task.id);
    setExpanded((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const clearDraft = (id: GanttId) => setDrafts((previous) => {
    const next = { ...previous };
    delete next[idKey(id)];
    return next;
  });
  const saveName = () => {
    if (!editing) return;
    const name = editing.value.trim();
    if (!name) { setNameError("任务名称不能为空"); return; }
    update(editing.id, { name }); setEditing(null); setNameError("");
  };
  const add = (parent?: GanttTaskData) => {
    if (parent && !canCreateChild(parent)) return;
    setCreating(parent ?? null);
  };
  const createTask = (values: TaskCreateValues) => {
    const id = `task:${crypto.randomUUID()}`;
    const task: GanttTaskData = { id, name: values.name, type: values.type, start: values.start, end: values.end, progress: 0, fields: values.fields, ...(creating ? { parent_id: creating.id } : {}) };
    commit({ ...snapshot, taskData: insertTask(snapshot.taskData, task) });
    setCreating(undefined);
  };
  const taskForRow = (id: GanttId) => snapshot.taskData.find((item) => item.id === id);
  const canDropOn = (sourceId: GanttId, targetId: GanttId) => {
    const source = taskForRow(sourceId);
    const target = taskForRow(targetId);
    return Boolean(source && target && source.id !== target.id && source.parent_id === target.parent_id && !descendants(snapshot.taskData, source.id).has(target.id));
  };
  const finishTaskDrop = (targetId: GanttId, position: TaskDropPosition) => {
    const sourceId = dragSession.current?.id;
    if (sourceId === undefined || !canDropOn(sourceId, targetId)) return;
    const taskData = reorderTasks(snapshot.taskData, sourceId, targetId, position);
    if (taskData !== snapshot.taskData) commit({ ...snapshot, taskData });
  };
  const clearTaskDrop = () => { dragSession.current = null; setDragTaskId(null); setDropTarget(null); };
  const native = Object.fromEntries(Object.entries(nativeProps).filter(([key]) => !["tasks", "links", "init", "columns", "gridWidth", "displayMode", "scales", "start", "end", "autoScale", "projectStart", "projectEnd"].includes(key))) as NativeGanttProps;
  const yearStart = useMemo(() => new Date(selectedYear, 0, 1), [selectedYear]);
  const yearEnd = useMemo(() => new Date(selectedYear + 1, 0, 1), [selectedYear]);
  const setYear = (year: number) => { if (controlledYear === undefined) setInternalYear(year); onYearChange?.(year); };
  const columns = nativeProps.columns === false ? [] : nativeProps.columns ?? [{ id: "text", header: "任务名称", width: 260 }, { id: "progress", header: "进度", width: 64, align: "right" }];
  return <div ref={hostRef} className={cn("kanx-gantt", className)} onPointerDownCapture={(event) => {
    if (readonly || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".wx-progress-marker, .wx-delete-button")) return;
    const bar = target.closest<HTMLElement>(".wx-bar[data-id]");
    const task = bar && snapshot.taskData.find((item) => matchesChartId(item.id, bar.dataset.id));
    if (!bar || !task) return;
    const endpoint = target.closest<HTMLElement>(".wx-link");
    const mode: TaskDragMode = endpoint ? (endpoint.classList.contains("wx-left") ? "start" : "end") : "move";
    gesture.current = { id: task.id, mode, x: event.clientX, days: 0, width: Number(nativeProps.cellWidth ?? 48), base: snapshot, previewTasks: snapshot.taskData, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
    document.body.style.userSelect = "none";
  }} onMouseDownCapture={(event) => { if (gesture.current) { event.preventDefault(); event.stopPropagation(); } }} onClickCapture={(event) => {
    // These native endpoints now resize dates; their original add-link click
    // must not run after pointerup and start a second interaction.
    if ((event.target as HTMLElement).closest(".wx-link")) { event.preventDefault(); event.stopPropagation(); }
  }}>
    <div className="kanx-toolbar"><div>{!readonly && <button type="button" onClick={() => add()}><Plus aria-hidden="true" size={15} />新增任务</button>}</div><div className="kanx-toolbar-right"><button ref={helpRef} type="button" aria-label="查看拖动规则" title="查看拖动规则" onClick={() => setRulesOpen(true)}><CircleHelp aria-hidden="true" size={18} /></button><label className="kanx-year-picker"><select aria-label="选择年度" value={selectedYear} onChange={(event) => setYear(Number(event.target.value))}>{yearOptions(thisYear).map((year) => <option key={year} value={year}>{year} 年</option>)}</select></label></div></div>
    <div className="kanx-body">
      {columns.length > 0 && <aside className="kanx-sidebar" style={{ width: gridWidth }} aria-label="任务列表">
        <div className="kanx-header" style={{ height: headerHeight }}>{columns.map((column) => <div className={column.id === "progress" ? "kanx-progress" : undefined} key={column.id} style={{ flex: column.id === "text" ? 1 : undefined, width: column.id === "text" ? undefined : column.width ?? 90 }}>{typeof column.header === "string" ? column.header : column.id === "progress" ? "进度" : column.id === "text" ? "任务名称" : column.id}</div>)}{!readonly && <span className="kanx-actions-heading">操作</span>}</div>
        <div className="kanx-list" ref={leftRef} onScroll={(event) => apiRef.current?.exec("scroll-chart", { top: event.currentTarget.scrollTop })}>
          <div style={{ minHeight: viewportHeight }}>
          {rows.map(({ task, depth, detailRows }) => <div key={idKey(task.id)}>
            <div
              className={`kanx-task-row${dragTaskId === task.id ? " kanx-dragging" : ""}${dropTarget?.id === task.id ? ` kanx-drop-${dropTarget.position}` : ""}`}
              style={{ height: rowHeight }}
              draggable={!readonly}
              aria-grabbed={dragTaskId === task.id}
              onDragStart={(event) => {
                if (readonly) return;
                dragSession.current = { id: task.id };
                setDragTaskId(task.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", idKey(task.id));
                setDropTarget(null);
              }}
              onDragOver={(event) => {
                const sourceId = dragSession.current?.id;
                if (sourceId === undefined || !canDropOn(sourceId, task.id)) { setDropTarget(null); return; }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const position: TaskDropPosition = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 ? "before" : "after";
                setDropTarget((previous) => previous?.id === task.id && previous.position === position ? previous : { id: task.id, position });
              }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }}
              onDrop={(event) => { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const position: TaskDropPosition = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"; finishTaskDrop(task.id, position); clearTaskDrop(); }}
              onDragEnd={clearTaskDrop}
              onClick={() => {
                if (dragSession.current) return;
                if (clickTimer.current) clearTimeout(clickTimer.current);
                const key = idKey(task.id);
                if (expanded.has(key)) {
                  setExpanded((previous) => { const next = new Set(previous); next.delete(key); return next; });
                  return;
                }
                setExpanded((previous) => previous.size ? new Set() : previous);
                clickTimer.current = setTimeout(() => toggleDetails(task), 230);
              }}
            >
              {columns.map((column) => <div className={`${column.id === "text" ? "kanx-name" : "kanx-cell"} ${column.id === "progress" ? "kanx-progress" : ""}`} key={column.id} style={{ flex: column.id === "text" ? 1 : undefined, width: column.id === "text" ? undefined : column.width ?? 90, textAlign: column.id === "progress" ? "right" : column.align }}>
                {column.id === "text" ? <>
                  {!readonly && <span className="kanx-drag-handle" title="拖拽调整同级顺序" aria-label="拖拽调整同级顺序"><GripVertical aria-hidden="true" size={15} /></span>}
                  <span style={{ width: depth * 16, flexShrink: 0 }} />
                  <TreeMarker depth={depth} hasChildren={snapshot.taskData.some((child) => child.parent_id === task.id)} open={task.open} name={task.name} onToggle={() => update(task.id, { open: task.open === false })} />
                  <span className={`kanx-type-badge ${task.type === "milestone" ? "kanx-type-badge-node" : "kanx-type-badge-period"}`} aria-label={`类型：${taskTypeLabel(task.type)}`}>{taskTypeLabel(task.type)}</span>
                  {editing?.id === task.id ? <input autoFocus aria-label="任务名称" className="kanx-name-input" value={editing.value} onClick={(event) => event.stopPropagation()} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onBlur={saveName} onKeyDown={(event) => { if (event.key === "Enter") saveName(); if (event.key === "Escape") { setEditing(null); setNameError(""); } }} /> : <Tooltip content={task.name}><button type="button" className="kanx-name-button" aria-expanded={expanded.has(idKey(task.id))} onDoubleClick={(event) => { event.stopPropagation(); if (clickTimer.current) clearTimeout(clickTimer.current); if (!readonly) { setEditing({ id: task.id, value: task.name }); setNameError(""); } }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggleDetails(task); } }}>{task.name}</button></Tooltip>}
                </> : column.id === "progress" ? `${task.progress ?? 0}%` : column.cell && renderApi ? <column.cell row={toSvarTasks([task])[0]} column={column as never} api={renderApi as never} onaction={() => undefined} /> : String((task as unknown as Record<string, unknown>)[column.id ?? ""] ?? task.fields?.[column.id ?? ""] ?? "")}
              </div>)}
              {!readonly && <div className="kanx-row-actions" onClick={(event) => event.stopPropagation()}>{depth === 0 && canCreateChild(task) ? <button type="button" aria-label={`新增子任务：${task.name}`} title="新增子任务" onClick={() => add(task)}><Plus aria-hidden="true" size={16} /></button> : <span className="kanx-action-spacer" aria-hidden="true" />}<button type="button" aria-label={`删除任务：${task.name}`} title="删除任务" onClick={() => setDeleting(task.id)}><X aria-hidden="true" size={16} /></button></div>}
            </div>
            {detailRows > 0 && <div className="kanx-detail" style={{ height: detailRows * rowHeight }}>
              <div className="kanx-detail-dates" aria-label="任务日期">{task.type === "milestone" ? <span><strong>发生日期：</strong>{taskDateLabel(task.start)}</span> : <><span><strong>开始日期：</strong>{taskDateLabel(task.start)}</span><span><strong>结束日期：</strong>{taskDateLabel(task.end)}</span></>}<span><strong>持续时间：</strong>{taskDurationDays(task.start, task.end)} 天</span></div>
              <FieldsEditor readonly={readonly} draft={draftFor(task)} onDraft={(draft) => setDrafts((previous) => ({ ...previous, [idKey(task.id)]: draft }))} onCommit={(fields) => { update(task.id, { fields }); clearDraft(task.id); }} />
            </div>}
          </div>)}
          </div>
        </div>
      </aside>}
      <div className="kanx-chart">{mounted ? <Willow><Gantt scales={chartScales} start={yearStart} end={yearEnd} autoScale={false} cellHeight={rowHeight} cellWidth={48} {...native} columns={emptyColumns} displayMode="chart" tasks={tasks} links={showDependencyArrows ? links : emptyLinks} init={init} /></Willow> : <div aria-label="正在加载甘特图" />}</div>
    </div>
    <TooltipContent open={chartTooltip !== null} content={chartTooltip?.content ?? ""} anchorRect={chartTooltip?.anchorRect ?? null} />
    {nameError && <div className="kanx-name-error" role="alert">{nameError}</div>}
    {creating !== undefined && <TaskCreateDialog parent={creating ?? undefined} onCancel={() => setCreating(undefined)} onConfirm={createTask} />}
    {rulesOpen && <div className="kanx-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeRules(); }}><div ref={rulesRef} className="kanx-confirm kanx-rules" role="dialog" aria-modal="true" aria-labelledby="kanx-rules-title" onKeyDown={(event) => { if (event.key === "Escape") closeRules(); if (event.key === "Tab") { event.preventDefault(); rulesRef.current?.querySelector("button")?.focus(); } }}><h3 id="kanx-rules-title">甘特图拖动规则</h3><div className="kanx-rules-content"><ol>
      <li>拖动父任务整体：父任务整体平移，所有子任务同步平移相同天数。</li>
      <li>拖动父任务左侧边缘：只改变父任务开始时间，所有子任务不变；父任务开始时间不得晚于最早子任务的开始时间。</li>
      <li>拖动父任务右侧边缘：只改变父任务结束时间，所有子任务不变；父任务结束时间不得早于最晚子任务的结束时间。</li>
      <li>相同父任务下的子任务整体拖动、边缘拖动相互独立，互不影响。</li>
      <li>所有父任务整体拖动、边缘拖动相互独立，互不影响。</li>
      <li>每次子任务更改后，父任务开始时间始终早于或等于最早子任务开始时间，结束时间始终晚于或等于最晚子任务结束时间；超出时只向外扩展，不自动收紧。</li>
      <li>节点任务和时段任务都遵循上述规则。</li>
    </ol><p>节点是开始时间与结束时间相同的特殊时段。拖动节点边缘产生跨度后转为时段，时段缩至同日后转为节点。边缘不能交叉。</p></div><div><button type="button" onClick={closeRules}>关闭</button></div></div></div>}
    {deleting !== null && <div className="kanx-modal-backdrop"><div className="kanx-confirm" role="alertdialog" aria-modal="true" aria-labelledby="kanx-delete-title" onKeyDown={(event) => {
      if (event.key === "Escape") setDeleting(null);
      if (event.key === "Tab") {
        const buttons = event.currentTarget.querySelectorAll("button");
        const target = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
        if (document.activeElement === target) { event.preventDefault(); (event.shiftKey ? buttons[buttons.length - 1] : buttons[0]).focus(); }
      }
    }}><h3 id="kanx-delete-title">删除任务</h3><p>确定删除“{snapshot.taskData.find((task) => task.id === deleting)?.name}”及其子任务吗？共 {descendants(snapshot.taskData, deleting).size} 个任务，关联依赖也将删除。</p><div><button type="button" autoFocus onClick={() => setDeleting(null)}>取消</button><button type="button" className="kanx-danger" onClick={() => {
      const removed = descendants(snapshot.taskData, deleting);
      commit(removeSubtree(snapshot.taskData, snapshot.edgeData, deleting));
      setExpanded((previous) => new Set([...previous].filter((key) => ![...removed].some((id) => idKey(id) === key))));
      setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => ![...removed].some((id) => idKey(id) === key))));
      if (clickTimer.current) clearTimeout(clickTimer.current);
      setDeleting(null); setEditing(null); setNameError("");
    }}>确认删除</button></div></div></div>}
  </div>;
}

export type { GanttEdgeData, GanttEdgeRenderStyle, GanttFields, GanttFieldValue, GanttId, GanttNativeProps, GanttSnapshot, GanttTaskData, GanttTaskRenderStyle } from "./types";
