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
- `package.json`: 包元数据、脚本和 GitHub Packages 发布配置。
- `.npmrc`: `@linghaoliofficial` scope 的 GitHub Packages registry 和 token 环境变量映射。
- `README.md`: 开发和组件安装说明。

## Setup and Runbook

```bash
pnpm install
pnpm dev
```

发布前运行：

```bash
pnpm prepublishOnly
NODE_AUTH_TOKEN="$(gh auth token)" npm publish --registry=https://npm.pkg.github.com
```

安装包的使用方需要配置 `@linghaoliofficial:registry=https://npm.pkg.github.com`；若包保持 private，还需要具备对应 GitHub Packages 读取权限。

## Testing and Verification

`pnpm prepublishOnly` 会依次执行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build:lib`。当前测试命令通过但项目没有测试用例。

## Current Decisions and Conventions

- 包名为 `@linghaoliofficial/kanx-gantt`，版本为 `0.1.4`。
- registry 为 `https://npm.pkg.github.com`，发布配置保留 `access: public`。
- token 只通过 `NODE_AUTH_TOKEN` 注入，不写入仓库。

## Known Issues and Follow-ups

- GitHub 创建包后当前可见性为 private；如需公开使用，需要在 GitHub 包设置中改为 public。
- `dist` 由 `prepublishOnly` 中的 `build:lib` 自动生成。
