"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type ComponentProps } from "react";
import { Gantt, Willow, type IApi, type ILink, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

import { cn } from "../../lib/utils";
import { fromSvarLinks, fromSvarTasks, toSvarLinks, toSvarTasks } from "./adapter";
import type { GanttEdgeData, GanttEdgeRenderStyle, GanttNativeProps, GanttSnapshot, GanttTaskData, GanttTaskRenderStyle } from "./types";

const subscribe = () => () => undefined;
const changeActions = ["add-task", "update-task", "delete-task", "move-task", "indent-task", "add-link", "update-link", "delete-link"] as const;

export type SvarGanttProps = {
  taskData: GanttTaskData[];
  edgeData?: GanttEdgeData[];
  taskRenderers?: Record<string, GanttTaskRenderStyle>;
  edgeRenderers?: Record<string, GanttEdgeRenderStyle>;
  showDependencyArrows?: boolean;
  onChange?: (snapshot: GanttSnapshot) => void;
  nativeProps?: GanttNativeProps;
  className?: string;
};

type NativeGanttProps = Omit<ComponentProps<typeof Gantt>, "tasks" | "links" | "taskTemplate" | "init"> & Record<string, unknown>;

export function SvarGantt({ className, taskData, edgeData = [], taskRenderers = {}, edgeRenderers = {}, showDependencyArrows = false, onChange, nativeProps = {} }: SvarGanttProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const hostRef = useRef<HTMLDivElement>(null);
  const originalsRef = useRef({ taskData, edgeData });
  useEffect(() => {
    originalsRef.current = { taskData, edgeData };
  }, [taskData, edgeData]);
  const tasks = useMemo(() => toSvarTasks(taskData), [taskData]);
  const links = useMemo(() => toSvarLinks(edgeData), [edgeData]);
  const native = nativeProps as NativeGanttProps;

  const emitSnapshot = (api: IApi) => {
    const state = api.getState();
    const svarTasks = (state._tasks ?? []) as ITask[];
    const svarLinks = (state._links ?? state.links ?? []) as ILink[];
    const nextEdgeData = showDependencyArrows
      ? fromSvarLinks(svarLinks, originalsRef.current.edgeData)
      : originalsRef.current.edgeData.map((edge) => ({ ...edge, fields: edge.fields ? { ...edge.fields } : undefined }));
    onChange?.({ taskData: fromSvarTasks(svarTasks, originalsRef.current.taskData), edgeData: nextEdgeData });
  };

  const init = (api: IApi) => {
    const nativeInit = native.init;
    if (typeof nativeInit === "function") nativeInit(api);
    const tag = "svar-gantt-business-snapshot";
    changeActions.forEach((action) => api.on(action, () => window.setTimeout(() => emitSnapshot(api), 0), { tag }));
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !Object.keys(edgeRenderers).length) return;
    const applyEdgeStyles = () => {
      host.querySelectorAll<SVGElement>(".wx-line").forEach((line) => {
        const rawId = line.getAttribute("data-link-id") ?? line.getAttribute("data-id") ?? line.getAttribute("id");
        const edge = edgeData.find((item) => String(item.id) === String(rawId));
        const style = edge && edgeRenderers[edge.type];
        if (!style) return;
        const path = line.querySelector<SVGElement>(".wx-line-draw") ?? line;
        if (style.color) path.setAttribute("stroke", style.color);
        if (style.width !== undefined) path.setAttribute("stroke-width", String(style.width));
        if (style.dash) path.setAttribute("stroke-dasharray", style.dash);
      });
    };
    applyEdgeStyles();
    const observer = new MutationObserver(applyEdgeStyles);
    observer.observe(host, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [edgeData, edgeRenderers, mounted]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !Object.keys(taskRenderers).length) return;
    const applyTaskStyles = () => {
      host.querySelectorAll<HTMLElement>(".wx-bar[data-id]").forEach((bar) => {
        const task = taskData.find((item) => String(item.id) === bar.dataset.id);
        const style = task && taskRenderers[task.type];
        if (!style) return;
        const isSummary = bar.classList.contains("wx-summary");
        const colorVar = isSummary ? "--wx-gantt-summary-color" : "--wx-gantt-task-color";
        const fillVar = isSummary ? "--wx-gantt-summary-fill-color" : "--wx-gantt-task-fill-color";
        const fontVar = isSummary ? "--wx-gantt-summary-font-color" : "--wx-gantt-task-font-color";
        const borderVar = isSummary ? "--wx-gantt-summary-border-color" : "--wx-gantt-task-border-color";
        if (style.barColor) bar.style.setProperty(colorVar, style.barColor);
        if (style.progressColor) bar.style.setProperty(fillVar, style.progressColor);
        if (style.fontColor) bar.style.setProperty(fontVar, style.fontColor);
        if (style.borderColor) bar.style.setProperty(borderVar, style.borderColor);
      });
    };
    applyTaskStyles();
    const observer = new MutationObserver(applyTaskStyles);
    observer.observe(host, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [taskData, taskRenderers, mounted]);

  const safeNative = Object.fromEntries(Object.entries(native).filter(([key]) => !["tasks", "links", "init", "taskTemplate"].includes(key))) as NativeGanttProps;
  return <div ref={hostRef} className={cn("h-full w-full", className)}>{mounted ? <Willow><Gantt {...safeNative} tasks={tasks} links={showDependencyArrows ? links : undefined} init={init} /></Willow> : <div aria-label="正在加载甘特图" className="h-full w-full animate-pulse bg-muted" />}</div>;
}

export type { GanttEdgeData, GanttEdgeRenderStyle, GanttFields, GanttFieldValue, GanttId, GanttNativeProps, GanttSnapshot, GanttTaskData, GanttTaskRenderStyle } from "./types";
