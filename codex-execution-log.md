## 2026-09-30 13:24 +08 - 发布 GitHub Packages npm 包

- Request: 将当前 npm 包发布到 GitHub 仓库的 GitHub Packages。
- Actions: 将包名改为 `@linghaoliofficial/kanx-gantt`；新增项目级 `.npmrc` registry 和 `NODE_AUTH_TOKEN` 配置；更新 README 安装说明；补齐 GitHub CLI 的 `write:packages` 授权；执行 `npm publish --registry=https://npm.pkg.github.com`。
- Result: 成功发布 `@linghaoliofficial/kanx-gantt@0.1.4`，包页面为 https://github.com/users/LinghaoLiOfficial/packages/npm/package/kanx-gantt；GitHub 当前将包标记为 private。
- Verification: `pnpm prepublishOnly` 通过（typecheck、lint、0 个测试、tsup 构建）；`npm view` 成功读取远端版本和 tarball；`git diff --check` 通过。
- Follow-ups: 如需公开安装，需在 GitHub 包设置页面将该包的可见性改为 public；当前 `publishConfig.access` 已保留为 public。
