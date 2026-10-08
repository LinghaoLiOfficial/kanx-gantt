"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FieldsEditor } from "./fields-editor";
import { parseDraft, toTaskDraft, type FieldDraft } from "./fields-state";
import type { GanttFields, GanttTaskData } from "./types";

type CreateType = "task" | "milestone";
export type TaskCreateValues = { name: string; type: CreateType; start: string; end: string; fields: GanttFields };

const dateValue = (value: string | Date) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function TaskCreateDialog({ parent, onCancel, onConfirm }: { parent?: GanttTaskData; onCancel: () => void; onConfirm: (values: TaskCreateValues) => void }) {
  const initialDate = parent ? dateValue(parent.start) : dateValue(new Date());
  const [name, setName] = useState("");
  const [type, setType] = useState<CreateType>("task");
  const [start, setStart] = useState(initialDate);
  const [end, setEnd] = useState(initialDate);
  const [draft, setDraft] = useState<FieldDraft[]>(() => toTaskDraft());
  const [error, setError] = useState("");

  useEffect(() => { setTimeout(() => document.getElementById("kanx-create-name")?.focus(), 0); }, []);
  const submit = () => {
    if (!name.trim()) { setError("任务名称不能为空"); return; }
    if (!start || (type === "task" && !end)) { setError("请选择日期"); return; }
    if (type === "task" && end < start) { setError("结束日期不能早于开始日期"); return; }
    const fields = parseDraft(draft);
    if (fields.error) { setError(fields.error); return; }
    setError("");
    onConfirm({ name: name.trim(), type, start, end: type === "milestone" ? start : end, fields: fields.fields ?? {} });
  };
  return <div className="kanx-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="kanx-confirm kanx-create" role="dialog" aria-modal="true" aria-labelledby="kanx-create-title" onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
      <div className="kanx-create-heading"><h3 id="kanx-create-title">{parent ? "新建子任务" : "新建任务"}</h3><button type="button" aria-label="关闭" title="关闭" onClick={onCancel}><X size={17} /></button></div>
      <label>任务名称<input id="kanx-create-name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <fieldset><legend>任务类型</legend><label><input type="radio" name="kanx-create-type" checked={type === "task"} onChange={() => setType("task")} />时段</label><label><input type="radio" name="kanx-create-type" checked={type === "milestone"} onChange={() => setType("milestone")} />节点</label></fieldset>
      {type === "milestone" ? <label className="kanx-create-milestone-date">发生日期<input type="date" value={start} onChange={(event) => { setStart(event.target.value); setEnd(event.target.value); }} /></label> : <div className="kanx-create-dates"><label>开始日期<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>结束日期<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>}
      <div className="kanx-create-fields"><div className="kanx-create-label">任务特征</div><FieldsEditor draft={draft} onDraft={setDraft} onCommit={() => undefined} readonly={false} /></div>
      {error && <div className="kanx-create-error" role="alert">{error}</div>}
      <div><button type="button" onClick={submit}>确认</button><button type="button" onClick={onCancel}>取消</button></div>
    </div>
  </div>;
}
