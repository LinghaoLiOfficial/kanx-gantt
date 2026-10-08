"use client";

import { useState } from "react";
import type { GanttFields } from "./types";
import { OWNER_FIELD, parseDraft, type FieldDraft } from "./fields-state";

export function FieldsEditor({ draft, onDraft, onCommit, readonly }: {
  draft: FieldDraft[]; onDraft: (draft: FieldDraft[]) => void; onCommit: (fields: GanttFields) => void; readonly: boolean;
}) {
  const [error, setError] = useState("");
  const change = (next: FieldDraft[]) => {
    const owner = draft.find((field) => field.key === OWNER_FIELD);
    const withOwner = owner && !next.some((field) => field.key === OWNER_FIELD) ? [owner, ...next] : next;
    onDraft(withOwner);
    const result = parseDraft(withOwner);
    if (result.error !== undefined) { setError(result.error); return; }
    setError(""); onCommit(result.fields);
  };
  const patchField = (index: number, patch: Partial<FieldDraft>) => change(draft.map((field, i) => i === index ? { ...field, ...patch } : field));
  const addField = () => {
    onDraft([...draft, { key: "", value: "" }]);
    setError("");
  };
  return <div className={`kanx-fields${draft.length ? "" : " kanx-fields-empty"}`} onClick={(event) => event.stopPropagation()}>
    {draft.map((field, index) => <div className="kanx-field" key={index}>
      {readonly ? <><span>{field.key}</span><span>{field.value}</span></> : <>
        <input aria-label={`特征 ${index + 1} 名称`} placeholder="特征名称" value={field.key} readOnly={field.key === OWNER_FIELD} onChange={(event) => patchField(index, { key: event.target.value })} />
        <input aria-label={`特征 ${index + 1} 值`} placeholder="特征值" value={field.value} onChange={(event) => patchField(index, { value: event.target.value })} />
        {field.key !== OWNER_FIELD && <button type="button" aria-label={`删除特征 ${index + 1}`} onClick={() => change(draft.filter((_, i) => i !== index))}>×</button>}
      </>}
    </div>)}
    {!readonly && <div className="kanx-field-actions"><button type="button" onClick={addField}>＋ 添加</button></div>}
    <div className="kanx-field-error" role="status">{error}</div>
  </div>;
}
