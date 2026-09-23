import type { IColumnConfig, IScaleConfig } from "@svar-ui/react-gantt";

export type GanttFieldValue = string | number | boolean | null;
export type GanttFields = Record<string, GanttFieldValue>;
export type GanttId = string | number;

export type GanttTaskData = {
  id: GanttId;
  name: string;
  type: string;
  start: string | Date;
  end: string | Date;
  progress?: number;
  parent_id?: GanttId;
  open?: boolean;
  fields?: GanttFields;
};

export type GanttEdgeData = {
  id: GanttId;
  name?: string;
  type: string;
  source_id: GanttId;
  target_id: GanttId;
  lag?: number;
  fields?: GanttFields;
};

export type GanttTaskRenderStyle = {
  barColor?: string;
  progressColor?: string;
  fontColor?: string;
  borderColor?: string;
};

export type GanttEdgeRenderStyle = {
  color?: string;
  width?: number;
  dash?: string;
};

export type GanttNativeProps = {
  scales?: IScaleConfig[];
  columns?: false | IColumnConfig[];
  readonly?: boolean;
  cellBorders?: "column" | "full";
  cellWidth?: number;
  gridWidth?: number;
  [key: string]: unknown;
};

export type GanttSnapshot = {
  taskData: GanttTaskData[];
  edgeData: GanttEdgeData[];
};
