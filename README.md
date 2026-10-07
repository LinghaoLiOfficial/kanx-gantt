# Kanx Gantt

基于 Next.js 16、React 19、TypeScript、Tailwind CSS 4 和 shadcn/ui 风格组件的前端项目。

## 安装组件库

项目使用 GitHub Packages 发布。安装前需在使用方项目的 `.npmrc` 中配置：

```ini
@linghaoliofficial:registry=https://npm.pkg.github.com
```

然后安装：

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
      fields: { 负责人: "张三", 工时: 16, 已确认: true, 备注: null },
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

单击任务行展开或收起特征字典；多个任务可同时展开，左右行保持对齐。`fields` 支持字符串、数字、布尔值和 `null`，编辑后点击“保存”提交，“取消”恢复。层级箭头单独控制子任务的展开收起。所有修改通过 `onChange` 返回完整业务数据，不包含图表详情占位行；持久化由使用方处理。设置 `nativeProps.readonly` 可只读展示。

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
