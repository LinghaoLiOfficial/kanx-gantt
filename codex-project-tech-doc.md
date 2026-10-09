# Project Technical Documentation

## Overview

这是一个基于 Next.js、React、TypeScript、Tailwind CSS 和 Svar Gantt 的甘特图项目，同时通过 `tsup` 构建可复用组件库。

## Architecture

- 应用入口位于 `src/app`。
- 可发布组件入口为 `src/index.ts`。
- `tsup.config.ts` 输出 ESM、CommonJS 和 TypeScript 声明文件到 `dist`。

## Key Files and Directories

- `src/`: 应用和组件源码。
- `dist/`: 发布构建产物，不纳入 Git。
- `package.json`: 包元数据、脚本和公共 npm 发布配置。
- `.npmrc`: 公共 npm registry，不包含 token 配置。
- `.github/workflows/publish.yml`: 标签触发的 npm Trusted Publishing 流程。
- `README.md`: 开发和组件安装说明。

## Setup and Runbook

```bash
pnpm install
pnpm dev
```

发布前运行：

```bash
pnpm prepublishOnly
```

升级 `package.json` 后提交并推送 `v<version>` 标签，由 GitHub Actions 验证版本、运行检查并通过 npm Trusted Publishing 发布。npm 侧的 trusted publisher 应对应 `LinghaoLiOfficial/kanx-gantt` 仓库和 `publish.yml` 工作流。使用方直接运行 `pnpm add kanx-gantt`，无需 GitHub token。

## Testing and Verification

`pnpm prepublishOnly` 会依次执行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build:lib`。任务行为测试位于 `tests/task-state.test.mjs`。

## Current Decisions and Conventions

- 包名为无 scope 的 `kanx-gantt`，版本为 `0.1.8`。
- registry 为 `https://registry.npmjs.org`，发布配置为 `access: public`。
- Actions 使用 OIDC Trusted Publishing 和 provenance，不使用 GitHub Packages token。

## Known Issues and Follow-ups

- 已发布的 GitHub Packages 版本保留，不删除；后续版本仅发布到公共 npm。
- `dist` 由 `prepublishOnly` 中的 `build:lib` 自动生成。
