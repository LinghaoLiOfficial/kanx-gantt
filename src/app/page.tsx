import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <section className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-6 rounded-full border bg-muted px-3 py-1 text-sm text-muted-foreground">
          Next.js 16 · React 19 · Tailwind CSS 4
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Kanx Gantt 已准备就绪
        </h1>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          基础前端脚手架已完成，可以从这里开始构建你的甘特图应用。
        </p>
        <Button className="mt-8" size="lg">
          开始构建
          <ArrowRight />
        </Button>
      </section>
    </main>
  );
}
