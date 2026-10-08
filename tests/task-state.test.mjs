import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile the pure helpers in memory so tests also run on the supported Node 20 runtime.
async function loadHelper(name) {
  const source = await readFile(new URL(`../src/components/gantt/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { applyChartUpdates, dragTask, canCreateChild, DEFAULT_GRID_WIDTH, firstTaskDate, idKey, insertTask, openingDate, removeSubtree, reorderTasks, summariesEndingAtMilestone, visibleTasks, yearOptions } = await loadHelper("task-state");
const { fromSvarTasks, toSvarTasks } = await loadHelper("adapter");
const { normalizeTaskFields, parseDraft, toDraft, toTaskDraft, OWNER_FIELD } = await loadHelper("fields-state");

const tasks = [
  { id: 1, name: "Root", type: "summary", start: "2026-10-01", end: "2026-10-05", open: true },
  { id: 2, name: "Child", type: "task", start: "2026-10-01", end: "2026-10-02", parent_id: 1, open: false, fields: { count: 0, enabled: false } },
  { id: 3, name: "Grandchild", type: "task", start: "2026-10-02", end: "2026-10-03", parent_id: 2 },
  { id: "1", name: "Other", type: "task", start: "2026-10-01", end: "2026-10-02" },
];

const plan = [
  { id: 1, name: "Parent", type: "summary", start: "2026-10-01", end: "2026-10-20" },
  { id: 2, name: "Child", type: "custom", start: "2026-10-05", end: "2026-10-10", parent_id: 1, fields: { enabled: false } },
  { id: 3, name: "Node", type: "milestone", start: "2026-10-15", end: "2026-10-15", parent_id: 1 },
  { id: 4, name: "Other parent", type: "task", start: "2026-10-02", end: "2026-10-18" },
  { id: 5, name: "Other child", type: "task", start: "2026-10-07", end: "2026-10-12", parent_id: 4 },
];
const day = (value) => { if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const range = (task) => [day(task.start), day(task.end)];

test("drag previews share unaffected tasks and never mutate the input snapshot", () => {
  const before = structuredClone(plan);
  const within = dragTask(plan, 2, "move", 2);
  assert.equal(within[0], plan[0]);
  assert.equal(within[2], plan[2]);
  const outside = dragTask(plan, 2, "start", -10);
  assert.notEqual(outside[0], plan[0]);
  assert.equal(outside[3], plan[3]);
  assert.equal(outside[4], plan[4]);
  assert.deepEqual(plan, before);
});

test("parent move shifts all descendants equally and leaves other branches unchanged", () => {
  for (const delta of [-4, 4]) {
    const result = dragTask(plan, 1, "move", delta);
    assert.equal(new Date(result[1].start).getDate(), 5 + delta);
    assert.equal(new Date(result[2].start).getDate(), 15 + delta);
    assert.deepEqual(result.slice(3), plan.slice(3));
    assert.deepEqual(result[1].fields, plan[1].fields);
  }
  const nested = dragTask(tasks, 1, "move", 2);
  assert.deepEqual(range(nested[2]), ["2026-10-04", "2026-10-05"]);
});

test("parent edges clamp at children, never move children, and allow outward extension", () => {
  for (const [mode, delta, expected] of [
    ["start", 30, ["2026-10-05", "2026-10-20"]],
    ["start", 4, ["2026-10-05", "2026-10-20"]],
    ["start", -3, ["2026-09-28", "2026-10-20"]],
    ["end", -30, ["2026-10-01", "2026-10-15"]],
    ["end", -5, ["2026-10-01", "2026-10-15"]],
    ["end", 3, ["2026-10-01", "2026-10-23"]],
  ]) {
    const result = dragTask(plan, 1, mode, delta);
    assert.deepEqual(range(result[0]), expected);
    assert.deepEqual(result.slice(1), plan.slice(1));
  }
});

test("child gestures change only that child and expand parents without shrinking slack", () => {
  for (const mode of ["move", "start", "end"]) for (const delta of [-10, 2, 20]) {
    const result = dragTask(plan, 2, mode, delta);
    assert.deepEqual(result.slice(2), plan.slice(2));
    assert.ok(day(result[0].start) <= day(result[1].start));
    assert.ok(day(result[0].end) >= day(result[1].end));
    assert.ok(day(result[0].start) <= plan[0].start);
    assert.ok(day(result[0].end) >= plan[0].end);
  }
  assert.deepEqual(range(dragTask(plan, 2, "move", 2)[0]), range(plan[0]));
});

test("parent recognition uses relationships rather than summary type", () => {
  const custom = plan.map((task) => task.id === 1 ? { ...task, type: "custom" } : task);
  assert.deepEqual(range(dragTask(custom, 3, "move", 10)[0]), ["2026-10-01", "2026-10-25"]);
  assert.deepEqual(range(dragTask(custom, 1, "start", 10)[0]), ["2026-10-05", "2026-10-20"]);
});

test("nodes resize into periods and periods collapse to nodes without crossing", () => {
  const right = dragTask(plan, 3, "end", 3);
  assert.equal(right[2].type, "task");
  assert.deepEqual(range(right[2]), ["2026-10-15", "2026-10-18"]);
  const left = dragTask(plan, 3, "start", -3);
  assert.deepEqual(range(left[2]), ["2026-10-12", "2026-10-15"]);
  const collapsed = dragTask(plan, 2, "start", 30);
  assert.equal(collapsed[1].type, "milestone");
  assert.deepEqual(range(collapsed[1]), ["2026-10-10", "2026-10-10"]);
  assert.equal(dragTask(plan, 2, "end", 2)[1].type, "custom");
  const nodeParent = [{ id: 1, type: "milestone", start: "2026-10-10", end: "2026-10-10" }, { id: 2, type: "milestone", start: "2026-10-10", end: "2026-10-10", parent_id: 1 }];
  assert.equal(dragTask(nodeParent, 1, "end", 2)[0].type, "summary");
});

test("nested edits expand every ancestor and calendar moves cross years and DST", () => {
  const result = dragTask(tasks, 3, "end", 10);
  assert.deepEqual(range(result[0]), ["2026-10-01", "2026-10-13"]);
  assert.deepEqual(range(result[1]), ["2026-10-01", "2026-10-13"]);
  const dates = [{ id: 1, type: "task", start: "2026-12-31", end: "2027-01-02" }];
  assert.deepEqual(range(dragTask(dates, 1, "move", 2)[0]), ["2027-01-02", "2027-01-04"]);
  assert.deepEqual(range(dragTask([{ id: 1, type: "task", start: "2026-03-07", end: "2026-03-10" }], 1, "move", 2)[0]), ["2026-03-09", "2026-03-12"]);
  assert.deepEqual(plan[0].start, "2026-10-01");
});

test("native progress events cannot leak automatic date rollups into business state", () => {
  const result = applyChartUpdates(plan, [{ ...plan[0], start: "2026-11-01", end: "2026-11-02", progress: 70 }]);
  assert.deepEqual(range(result[0]), range(plan[0]));
  assert.equal(result[0].progress, 70);
  assert.deepEqual(result.slice(1), plan.slice(1));
});

test("clamped and zero-distance drags preserve the snapshot without a commit", () => {
  const node = [{ id: 1, type: "milestone", start: "2026-10-10", end: "2026-10-10" }];
  assert.equal(dragTask(node, 1, "end", -2), node);
  assert.equal(dragTask(node, 1, "start", 2), node);
  assert.equal(dragTask(node, 1, "move", 0), node);
});

test("visible projection preserves hierarchy and distinguishes numeric/string IDs", () => {
  const rows = visibleTasks(tasks, new Set([idKey(2)]), () => 4);
  assert.deepEqual(rows.map(({ task, depth, detailRows }) => [task.id, depth, detailRows]), [[1, 0, 0], [2, 1, 4], ["1", 0, 0]]);
  assert.equal(tasks.length, 4);
});

test("reorderTasks moves top-level subtrees while preserving their internal order", () => {
  const result = reorderTasks(tasks, 1, "1", "after");
  assert.deepEqual(result.map((task) => task.id), ["1", 1, 2, 3]);
  assert.equal(result[2], tasks[1]);
  assert.equal(result[3], tasks[2]);
});

test("reorderTasks moves same-parent children and rejects cross-parent drops", () => {
  const result = reorderTasks(plan, 3, 2, "before");
  assert.deepEqual(result.map((task) => task.id), [1, 3, 2, 4, 5]);
  assert.deepEqual(reorderTasks(plan, 2, 5, "before"), plan);
});

test("reorderTasks carries nested descendants and rejects self or descendant targets", () => {
  const result = reorderTasks(tasks, 2, "1", "before");
  assert.deepEqual(result, tasks);
  const nested = [...tasks, { id: 4, name: "Sibling", type: "task", parent_id: 1, start: "2026-10-04", end: "2026-10-05" }];
  const moved = reorderTasks(nested, 2, 4, "after");
  assert.deepEqual(moved.map((task) => task.id), [1, "1", 4, 2, 3]);
  assert.equal(moved[3].parent_id, 1);
  assert.equal(moved[4].parent_id, 2);
});

test("deletion removes descendants and their links, including hidden dependencies", () => {
  const edges = [{ id: 1, source_id: 3, target_id: "1", type: "e2s" }, { id: 2, source_id: "1", target_id: "1", type: "e2s" }];
  const result = removeSubtree(tasks, edges, 2);
  assert.deepEqual(result.taskData.map((task) => task.id), [1, "1"]);
  assert.deepEqual(result.edgeData.map((edge) => edge.id), [2]);
});


test("empty field dictionaries replace saved dictionaries rather than resurrecting deleted keys", () => {
  const internal = toSvarTasks(tasks);
  internal[1].$businessFields = {};
  assert.deepEqual(fromSvarTasks(internal, tasks)[1].fields, {});
});

test("chart serialization preserves parent links for flattened rows", () => {
  const internal = toSvarTasks(tasks);
  const restored = fromSvarTasks(internal, tasks);
  assert.equal(restored[1].parent_id, 1);
  assert.equal(restored[2].parent_id, 2);
});

test("summary display end aligns with its terminal milestone without changing business dates", () => {
  const plan = [
    { id: 1, name: "Root", type: "summary", start: "2026-10-01", end: "2026-10-10" },
    { id: 2, name: "Nested summary", type: "summary", start: "2026-10-05", end: "2026-10-10", parent_id: 1 },
    { id: 8, name: "Launch", type: "milestone", start: "2026-10-10", end: "2026-10-10", parent_id: 2 },
  ];
  const ids = summariesEndingAtMilestone(plan);
  assert.deepEqual([...ids], [1, 2]);
  const projection = toSvarTasks(plan, { summaryEndAtMilestoneIds: ids });
  assert.equal(day(projection[0].end), "2026-10-09");
  assert.equal(day(projection[1].end), "2026-10-09");
  assert.equal(day(projection[2].end), "2026-10-10");
  assert.equal(plan[0].end, "2026-10-10");
  const restored = fromSvarTasks(projection, plan, { summaryEndAtMilestoneIds: ids });
  assert.equal(day(restored[0].end), "2026-10-10");
  assert.equal(day(restored[1].end), "2026-10-10");
});


test("field draft conversion stringifies legacy scalar values and preserves special dictionary keys", () => {
  const fields = JSON.parse('{"text":"","number":0,"enabled":false,"empty":null,"__proto__":"safe"}');
  assert.deepEqual(toDraft(fields), [
    { key: "text", value: "" },
    { key: "number", value: "0" },
    { key: "enabled", value: "false" },
    { key: "empty", value: "null" },
    { key: "__proto__", value: "safe" },
  ]);
  assert.deepEqual(parseDraft(toDraft(fields)).fields, Object.fromEntries([
    ["text", ""], ["number", "0"], ["enabled", "false"], ["empty", "null"], ["__proto__", "safe"],
  ]));
  assert.deepEqual(parseDraft([]).fields, {});
});

test("task fields always include an editable owner feature", () => {
  assert.deepEqual(normalizeTaskFields(undefined), { [OWNER_FIELD]: "" });
  assert.deepEqual(normalizeTaskFields({ budget: 12 }), { budget: "12", [OWNER_FIELD]: "" });
  assert.deepEqual(toTaskDraft({ budget: 12 }).at(0), { key: OWNER_FIELD, value: "" });
  assert.deepEqual(toTaskDraft({ budget: 12, [OWNER_FIELD]: "张三" }).at(0), { key: OWNER_FIELD, value: "张三" });
  assert.deepEqual(parseDraft(toTaskDraft()).fields, { [OWNER_FIELD]: "" });
});

test("field validation rejects empty and duplicate keys while accepting any string value", () => {
  assert.ok(parseDraft([{ key: " ", value: "x" }]).error);
  assert.ok(parseDraft([{ key: "name", value: "a" }, { key: " name ", value: "b" }]).error);
  for (const value of ["", " ", "abc", "Infinity", "0", "false", "null"]) {
    assert.deepEqual(parseDraft([{ key: "value", value }]).fields, { value });
  }
});

test("field order survives realtime saves when names look like integer keys", () => {
  const draft = [
    { key: "负责人", value: "" },
    { key: "优先级", value: "高" },
    { key: "10", value: "十" },
    { key: "2", value: "二" },
  ];
  const saved = parseDraft(draft).fields;
  assert.deepEqual(toTaskDraft(saved), draft);
});

test("adapter normalizes legacy task field values on input and output", () => {
  const legacy = [{ ...tasks[1], fields: { count: 40, enabled: true, empty: null } }];
  const internal = toSvarTasks(legacy);
  assert.deepEqual(internal[0].$businessFields, { count: "40", enabled: "true", empty: "null" });
  assert.deepEqual(fromSvarTasks(internal, legacy)[0].fields, { count: "40", enabled: "true", empty: "null" });
});

test("annual view uses a compact sidebar and current year plus adjacent years", () => {
  assert.equal(DEFAULT_GRID_WIDTH, 380);
  assert.deepEqual(yearOptions(2026), [2027, 2026, 2025]);
});

test("only root tasks can create children", () => {
  assert.equal(canCreateChild(tasks[0]), true);
  assert.equal(canCreateChild(tasks[1]), false);
  assert.equal(canCreateChild(tasks[2]), false);
  assert.equal(canCreateChild({ ...tasks[0], type: "milestone", parent_id: undefined }), false);
});

test("inserting a child expands its parent without shrinking existing slack", () => {
  const child = { id: 9, name: "New", type: "task", parent_id: 1, start: "2026-09-20", end: "2026-10-25" };
  const result = insertTask(plan, child);
  assert.deepEqual(range(result[0]), ["2026-09-20", "2026-10-25"]);
  assert.equal(result.at(-1), child);
  const inside = insertTask(plan, { ...child, id: 10, start: "2026-10-05", end: "2026-10-10" });
  assert.deepEqual(range(inside[0]), range(plan[0]));
  assert.equal(inside[0].type, "summary");
});

test("annual view opens at the earliest visible task date", () => {
  assert.deepEqual(
    [firstTaskDate(tasks, 2026).getFullYear(), firstTaskDate(tasks, 2026).getMonth(), firstTaskDate(tasks, 2026).getDate(), firstTaskDate(tasks, 2026).getHours()],
    [2026, 9, 1, 0],
  );
  assert.equal(firstTaskDate(tasks, 2025).getFullYear(), 2025);
  assert.equal(firstTaskDate(tasks, 2025).getMonth(), 0);
  assert.equal(firstTaskDate(tasks, 2025).getDate(), 1);
  assert.equal(firstTaskDate([{ ...tasks[0], start: "2025-12-20", end: "2026-01-04" }], 2026).getMonth(), 0);
});

test("opening date is the day before the earliest task and clamps to the year start", () => {
  const [year, month, day] = [openingDate(tasks, 2026).getFullYear(), openingDate(tasks, 2026).getMonth(), openingDate(tasks, 2026).getDate()];
  assert.deepEqual([year, month, day], [2026, 8, 30]);
  const emptyYear = openingDate([], 2025);
  assert.deepEqual([emptyYear.getFullYear(), emptyYear.getMonth(), emptyYear.getDate()], [2025, 0, 1]);
  const clamped = openingDate([{ ...tasks[0], start: "2025-12-20", end: "2026-01-04" }], 2026);
  assert.deepEqual([clamped.getFullYear(), clamped.getMonth(), clamped.getDate()], [2026, 0, 1]);
  assert.equal(openingDate(tasks, 2026).getHours(), 0);
});
