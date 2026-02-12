# Linear Automation

统一管理多个基于 GitHub Actions 的自动化任务（automation）。

## 项目目标

- 在一个仓库中维护多个自动化任务脚本和工作流。
- 使用 `schedule` 触发任务，避免手动触发依赖。
- 统一管理凭据、变量和运行规范。

## 目录约定

- `.github/workflows/`
  - 每个 automation 对应一个独立 workflow 文件。
- `scripts/`
  - 每个 automation 对应一个独立脚本入口（TypeScript）。

## 当前已实现的 Automations

### 1. Archive Linear Issues

- Workflow: `.github/workflows/linear-archive.yml`
- Script: `scripts/archive.ts`
- Trigger: 每天 UTC 02:00（`0 2 * * *`）

## GitHub Actions 配置

在仓库 `Settings -> Secrets and variables -> Actions` 配置变量。

### Archive automation 必选

- `LINEAR_API_KEY`（Secret）
  - Linear 个人 API Key，至少具备 read/write issue 权限。
- `LINEAR_TEAM_KEY`（Variable）
  - 只归档指定 team（例如 `ENG`）。
  - 未设置时任务会直接失败并退出。

### Archive automation 可选

- `ARCHIVE_AFTER_DAYS`（Variable）
  - 归档阈值天数，默认 `14`。
- `DRY_RUN`（Variable）
  - 默认 `false`（实际归档）。
  - 设为 `true` 时仅预览，不实际归档。

## 本地运行（Archive）

```bash
bun install
LINEAR_API_KEY=xxx LINEAR_TEAM_KEY=ENG bun run archive
```

## 新增 Automation 规范

1. 在 `scripts/` 新增单独脚本入口。
2. 在 `.github/workflows/` 新增对应 workflow。
3. 为该 automation 在 README 增加独立小节（触发、必选变量、可选变量）。
4. 默认使用 `schedule` 触发，不添加手动触发入口。
