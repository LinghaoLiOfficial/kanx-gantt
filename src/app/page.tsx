import { SvarGantt } from "@/components/gantt/svar-gantt";
import {
  frontendStackEdgeData,
  frontendStackEdgeRenderers,
  frontendStackNativeProps,
  frontendStackTaskData,
  frontendStackTaskRenderers,
} from "@/data/frontend-stack-plan";

const showDependencyArrows = false;

export default function Home() {
  return (
    <main className="min-h-svh bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              Next.js 16 · React 19 · SVAR React Gantt
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              前端技术栈建设计划
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">
              从技术选型到正式上线的示例计划。业务数据由通用组件适配为甘特图，支持拖动任务条、调整进度或展开层级。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            示例数据仅保存在当前页面
          </div>
        </header>

        <section
          aria-label="前端技术栈甘特图"
          className="overflow-hidden rounded-xl border bg-background shadow-sm"
        >
          <div className="overflow-x-auto">
            <SvarGantt
              className="h-[560px] min-w-[960px]"
              taskData={frontendStackTaskData}
              edgeData={frontendStackEdgeData}
              taskRenderers={frontendStackTaskRenderers}
              edgeRenderers={frontendStackEdgeRenderers}
              nativeProps={frontendStackNativeProps}
              showDependencyArrows={showDependencyArrows}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
