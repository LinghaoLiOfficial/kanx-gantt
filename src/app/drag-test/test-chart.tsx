"use client";
import { Profiler, useCallback, useEffect, useRef, useState } from "react";
import type { IApi } from "@svar-ui/react-gantt";
import { SvarGantt } from "../../components/gantt/svar-gantt";
import type { GanttTaskData } from "../../components/gantt/types";
const initial: GanttTaskData[] = [
  { id: "a", name: "父任务 A", type: "summary", start: "2026-10-03", end: "2026-10-16", open: true },
  { id: "a1", name: "子任务 A1", type: "task", start: "2026-10-05", end: "2026-10-08", parent_id: "a" },
  { id: "a2", name: "节点 A2", type: "milestone", start: "2026-10-12", end: "2026-10-12", parent_id: "a" },
  { id: "b", name: "父任务 B", type: "task", start: "2026-10-04", end: "2026-10-15", open: true },
  { id: "b1", name: "子任务 B1", type: "task", start: "2026-10-06", end: "2026-10-09", parent_id: "b" },
  { id: "b2", name: "节点 B2", type: "milestone", start: "2026-10-11", end: "2026-10-11", parent_id: "b" },
];
const day = (value: string | Date) => { if (typeof value === "string") return value; const d = value; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const yearBoundary = initial.map((task) => ({ ...task, start: String(task.start).replace("-10-", "-01-"), end: String(task.end).replace("-10-", "-01-") }));
export default function DragTest() {
  const [scenario, setScenario] = useState("default");
  const [tasks, setTasks] = useState(initial);
  const [count, setCount] = useState(0);
  const [readonly, setReadonly] = useState(false);
  const [initializations, setInitializations] = useState(0);
  const apiRef = useRef<IApi | null>(null);
  const onInit = useCallback((api: IApi) => { apiRef.current = api; setInitializations((n) => n + 1); }, []);
  useEffect(() => {
    // Switching fixtures explicitly positions the view; date drags never do.
    apiRef.current?.exec("scroll-chart", { date: new Date(2026, scenario === "year" ? 0 : 9, 1) });
  }, [scenario]);
  const renderCount = useRef(0);
  const renderOutput = useRef<HTMLOutputElement>(null);
  return <main style={{ padding: 16 }}>
    <h1>拖动规则验收</h1>
    <select aria-label="测试场景" value={scenario} onChange={(event) => { setScenario(event.target.value); setTasks(event.target.value === "year" ? yearBoundary : initial); setCount(0); }}><option value="default">独立分支与节点</option><option value="year">跨年</option></select>
    <button onClick={() => { setTasks(scenario === "year" ? yearBoundary : initial); setCount(0); }}>重置测试数据</button>
    <label><input type="checkbox" checked={readonly} onChange={(event) => setReadonly(event.target.checked)} />只读</label>
    <output data-testid="commits">提交次数：{count}</output>
    <output data-testid="initializations" style={{ marginLeft: 16 }}>图表初始化次数：{initializations}</output>
    <output ref={renderOutput} data-testid="renders" style={{ marginLeft: 16 }} />
    <Profiler id="chart" onRender={() => { renderCount.current++; if (renderOutput.current) renderOutput.current.textContent = `图表子树渲染次数：${renderCount.current}`; }}>
      <SvarGantt taskData={tasks} selectedYear={2026} nativeProps={{ cellWidth: 36, readonly, init: onInit }} onChange={(next) => { setTasks(next.taskData); setCount((n) => n + 1); }} className="h-[420px]" />
    </Profiler>
    <table><thead><tr><th>任务</th><th>开始</th><th>结束</th><th>类型</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} data-result={task.id}><td>{task.name}</td><td>{day(task.start)}</td><td>{day(task.end)}</td><td>{task.type}</td></tr>)}</tbody></table>
  </main>;
}
