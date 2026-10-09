# Kanx Gantt

基于 Next.js 16、React 19、TypeScript、Tailwind CSS 4 和 shadcn/ui 风格组件的前端项目。

## 安装组件库

项目发布到公共 npm registry。安装包时直接执行：

```bash
pnpm add @linghaoliofficial/kanx-gantt
```

在客户端组件中引入组件和样式，并为容器设置高度：

```tsx
"use client";

import { useState } from "react";
import { SvarGantt, type GanttSnapshot } from "@linghaoliofficial/kanx-gantt";
import "@linghaoliofficial/kanx-gantt/style.css";

export function ProjectPlan() {
  const [snapshot, setSnapshot] = useState<GanttSnapshot>({
    taskData: [{
      id: 1, name: "项目准备", type: "task",
      start: "2026-10-01", end: "2026-10-03", progress: 20,
      fields: { 负责人: "张三", 工时: "16", 已确认: "true", 备注: "null" },
    }],
    edgeData: [],
  });
  return <div style={{ height: 560 }}>
    <SvarGantt {...snapshot} onChange={setSnapshot} className="h-full" />
  </div>;
}
```

默认时间轴按天显示，并通过右上角年度下拉框查看当前年份及相邻年份的完整自然年。进度显示百分号并右对齐。左侧默认宽度为 `380px`，可通过 `nativeProps.gridWidth` 覆盖。

左侧可新增任务和一级子任务，最多支持任务、子任务两级；子任务不能继续创建下级任务。双击任务名称编辑（Enter 或失焦保存，Esc 取消）。删除前确认，删除父任务会同时删除全部子任务和关联依赖。

单击任务行展开或收起特征字典；多个任务可同时展开，左右行保持对齐。`fields` 是“特征名称到字符串值”的字典，编辑后会自动保存；非法输入会保留在编辑器中并提示错误，修正后自动提交。旧数据中的数字、布尔值和 `null` 会在读取时转换为字符串。层级箭头单独控制子任务的展开收起。所有修改通过 `onChange` 返回完整业务数据，不包含图表详情占位行；持久化由使用方处理。设置 `nativeProps.readonly` 可只读展示。

每个任务都内置一个不可删除、不可重命名的“负责人”特征；负责人值允许为空，且可在任务详情中编辑。新增任务会自动带上该特征。

左侧任务列表支持上下拖拽调整同级任务顺序。父任务拖动时会携带全部子任务并保持子任务内部顺序；子任务只能在同一父任务下调整，不能通过拖拽改变父子关系或跨父级移动。排序结果通过 `onChange` 返回，设置 `nativeProps.readonly` 后不可拖拽。

年度默认由组件内部管理。需要受控时传入 `selectedYear` 和 `onYearChange`；年度切换只改变时间轴范围，不修改或过滤业务任务。

拖动父任务整体会按相同日历天数平移所有子孙任务（包括折叠隐藏的任务）。拖动父任务左、右边缘只修改该侧日期，不能越过最早子任务开始时间或最晚子任务结束时间。子任务之间、不同父任务分支之间独立；子任务超出父任务范围时只向外扩展对应祖先，不自动收紧预留时间。父子关系以 `parent_id` 为准，与任务类型无关。

左右日期调整统一使用 SVAR 自带的圆形端点，任务条本体（包括靠近边缘的位置）只用于整体平移，不增加额外把手。圆形端点原本用于创建依赖，在本组件中改为日期调整入口；已有依赖箭头仍可显示。任务边缘可缩至同日，但不能交叉；同日转换为节点，节点边缘拉出跨度后转换为时段（有子任务时为 `summary`，否则为 `task`）。年度选择器旁的问号按钮展示完整规则，支持关闭按钮、遮罩或 Escape 关闭，只读模式也可查看。

## 开始开发

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 可用命令

```bash
pnpm dev      # 启动开发服务器
pnpm build    # 创建生产构建
pnpm start    # 启动生产服务器
pnpm lint     # 运行 ESLint
```
