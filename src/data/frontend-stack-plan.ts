import type { IColumnConfig, IScaleConfig } from "@svar-ui/react-gantt";
import type { GanttEdgeData, GanttEdgeRenderStyle, GanttNativeProps, GanttTaskData, GanttTaskRenderStyle } from "@/components/gantt/types";

export const frontendStackTaskData: GanttTaskData[] = [
  { id: 1, name: "前端技术栈建设", type: "summary", start: "2026-09-22", end: "2026-10-18", progress: 46, open: true },
  { id: 2, name: "需求梳理与架构设计", type: "planning", start: "2026-09-22", end: "2026-09-25", progress: 100, parent_id: 1 },
  { id: 3, name: "Next.js 与 TypeScript 脚手架", type: "framework", start: "2026-09-25", end: "2026-09-29", progress: 100, parent_id: 1 },
  { id: 4, name: "Tailwind CSS 主题系统", type: "styling", start: "2026-09-29", end: "2026-10-03", progress: 75, parent_id: 1 },
  { id: 5, name: "shadcn/ui 基础组件", type: "ui", start: "2026-10-02", end: "2026-10-07", progress: 55, parent_id: 1 },
  { id: 6, name: "甘特图核心视图", type: "feature", start: "2026-10-06", end: "2026-10-12", progress: 30, parent_id: 1 },
  { id: 7, name: "代码质量与性能验证", type: "quality", start: "2026-10-12", end: "2026-10-17", progress: 0, parent_id: 1 },
  { id: 8, name: "正式上线", type: "milestone", start: "2026-10-18", end: "2026-10-18", progress: 0, parent_id: 1 },
];

export const frontendStackEdgeData: GanttEdgeData[] = [
  { id: 1, name: "架构完成后开始", type: "finish-to-start", source_id: 2, target_id: 3 },
  { id: 2, type: "finish-to-start", source_id: 3, target_id: 4 },
  { id: 3, type: "finish-to-start", source_id: 4, target_id: 5 },
  { id: 4, type: "finish-to-start", source_id: 5, target_id: 6 },
  { id: 5, type: "finish-to-start", source_id: 6, target_id: 7 },
  { id: 6, type: "finish-to-start", source_id: 7, target_id: 8 },
];

export const frontendStackTaskRenderers: Record<string, GanttTaskRenderStyle> = {
  summary: { barColor: "#0f766e", progressColor: "#115e59", fontColor: "#ffffff", borderColor: "#0f766e" },
  planning: { barColor: "#64748b", progressColor: "#475569", borderColor: "#64748b" },
  framework: { barColor: "#2563eb", progressColor: "#1d4ed8", borderColor: "#2563eb" },
  styling: { barColor: "#0891b2", progressColor: "#0e7490", borderColor: "#0891b2" },
  ui: { barColor: "#7c3aed", progressColor: "#6d28d9", borderColor: "#7c3aed" },
  feature: { barColor: "#ea580c", progressColor: "#c2410c", borderColor: "#ea580c" },
  quality: { barColor: "#16a34a", progressColor: "#15803d", borderColor: "#16a34a" },
  milestone: { barColor: "#db2777", progressColor: "#be185d", borderColor: "#db2777" },
};

export const frontendStackEdgeRenderers: Record<string, GanttEdgeRenderStyle> = {
  "finish-to-start": { color: "#64748b", width: 2, dash: "6 3" },
};

const scales: IScaleConfig[] = [
  { unit: "month", step: 1, format: "%Y 年 %m 月" },
  { unit: "week", step: 1, format: "第 %w 周" },
];

const columns: IColumnConfig[] = [
  { id: "text", header: "任务名称", width: 300 },
  { id: "progress", header: "进度", width: 90, align: "right" },
];

export const frontendStackNativeProps: GanttNativeProps = {
  scales,
  columns,
  cellBorders: "full",
  cellWidth: 72,
  gridWidth: 430,
};
