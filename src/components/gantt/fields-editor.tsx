"use client";

import { useState } from "react";
import type { GanttFields } from "./types";
import { parseDraft, type FieldDraft } from "./fields-state";

export function FieldsEditor({ draft, onDraft, onSave, onCancel, readonly }: {
  draft: FieldDraft[]; onDraft: (draft: FieldDraft[]) => void; onSave: (fields: GanttFields) => void; onCancel: () => void; readonly: boolean;
}) {
  const [error, setError] = useState("");
  const change = (index: number, patch: Partial<FieldDraft>) => { setError(""); onDraft(draft.map((field, i) => i === index ? { ...field, ...patch } : field)); };
  const save = () => {
    const result = parseDraft(draft);
    if (result.error !== undefined) { setError(result.error); return; }
    setError(""); onSave(result.fields);
  };
  return <div className="kanx-fields" onClick={(event) => event.stopPropagation()}>
    <div className="kanx-fields-title">任务特征</div>
    {!draft.length && <div className="kanx-fields-empty">暂无特征</div>}
    {draft.map((field, index) => <div className="kanx-field" key={index}>
      {readonly ? <><span>{field.key}</span><span>{field.type === "null" ? "null" : field.value}</span></> : <>
        <input aria-label={`特征 ${index + 1} 名称`} placeholder="特征名称" value={field.key} onChange={(event) => change(index, { key: event.target.value })} />
        <select aria-label={`特征 ${index + 1} 类型`} value={field.type} onChange={(event) => change(index, { type: event.target.value as FieldDraft["type"], value: event.target.value === "boolean" ? "false" : field.value })}>
          <option value="string">文本</option><option value="number">数字</option><option value="boolean">布尔</option><option value="null">空值</option>
        </select>
        {field.type === "boolean" ? <select aria-label={`特征 ${index + 1} 值`} value={field.value} onChange={(event) => change(index, { value: event.target.value })}><option value="true">true</option><option value="false">false</option></select> : <input aria-label={`特征 ${index + 1} 值`} placeholder="特征值" disabled={field.type === "null"} value={field.type === "null" ? "null" : field.value} onChange={(event) => change(index, { value: event.target.value })} />}
        <button type="button" aria-label={`删除特征 ${index + 1}`} onClick={() => onDraft(draft.filter((_, i) => i !== index))}>×</button>
      </>}
    </div>)}
    {!readonly && <div className="kanx-field-actions"><button type="button" onClick={() => onDraft([...draft, { key: "", type: "string", value: "" }])}>＋ 添加特征</button><button type="button" onClick={save}>保存</button><button type="button" onClick={() => { setError(""); onCancel(); }}>取消</button></div>}
    <div className="kanx-field-error" role="status">{error}</div>
  </div>;
}
