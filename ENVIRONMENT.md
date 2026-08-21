# 开发环境配置

本文约定整个学习仓库使用一致的开发环境。先完成这里的配置，再开始第 1 周任务。

## 1. 版本要求

| 工具 | 推荐版本 | 说明 |
| --- | --- | --- |
| Node.js | 24.x LTS | 仓库根目录的 `.nvmrc` 已固定主版本 |
| pnpm | 11.x | 使用稳定版本，不使用 pnpm 12 RC |
| TypeScript | 7.x | 作为项目本地开发依赖安装，不要全局安装 |
| Git | 2.40 或更高 | 用于版本管理 |
| 编辑器 | VS Code 或已有编辑器 | 不强制更换熟悉的开发工具 |

截至 2026-08-21，Node.js 24 是 LTS，Node.js 26 是 Current。学习和项目实践优先选择 LTS，不追逐 Current 版本。

如果 `node --version` 显示的是旧版本，请先切换到 24.x；不要尝试在 Node.js 12 等已停止支持的版本下安装或运行本计划的依赖。

## 2. 安装 Node.js

推荐使用版本管理器安装 Node.js，便于不同项目切换版本。无论使用哪一种工具，目标都是安装最新的 Node.js 24.x 补丁版本。

### Windows

可以使用 nvm-windows、fnm，或从 Node.js 官网安装 24.x LTS。若使用版本管理器，安装后在仓库目录执行对应的版本切换命令。例如使用 nvm：

```powershell
nvm install 24
nvm use 24
```

### macOS / Linux

如果已经安装 nvm，可在仓库根目录执行：

```bash
nvm install
nvm use
```

命令会读取仓库中的 `.nvmrc`。

## 3. 安装 pnpm

Windows 上可通过 npm 安装当前稳定的 pnpm：

```powershell
npx get-pnpm
```

安装后确认主版本为 11。如果安装命令默认版本已发生变化，请显式选择 pnpm 11，不要在学习期间自动升级主版本。

每个实践项目创建 `package.json` 后，都应使用 `packageManager` 字段锁定实际使用的完整版本：

```json
{
  "packageManager": "pnpm@11.x.x",
  "engines": {
    "node": ">=24 <25",
    "pnpm": ">=11 <12"
  }
}
```

将示例中的 `11.x.x` 替换为 `pnpm --version` 显示的完整版本，并提交 `pnpm-lock.yaml`。不要手动编辑 lockfile。

## 4. 环境自检

在 PowerShell 或终端中执行：

```powershell
node --version
pnpm --version
git --version
```

预期结果：

- `node --version` 以 `v24.` 开头；
- `pnpm --version` 以 `11.` 开头；
- 三条命令均能正常返回且没有找不到命令的错误。

如果刚完成安装但终端找不到命令，关闭并重新打开终端，使 `PATH` 更新生效。

## 5. 第一个 TypeScript 项目的基础依赖

进入每周实践目录并初始化项目：

```powershell
pnpm init
pnpm add zod dotenv
pnpm add -D typescript tsx @types/node vitest
```

建议在 `package.json` 中提供以下脚本：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

建议从以下严格配置开始：

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

学习初期使用 `tsx` 直接运行 TypeScript，减少构建配置干扰；准备部署时再增加正式的构建流程。

## 6. 环境变量与密钥

在每个需要调用模型的项目中创建 `.env.example`：

```dotenv
MODEL_API_KEY=
MODEL_BASE_URL=
MODEL_NAME=
```

复制为本地 `.env` 后填写真实值。确保 `.gitignore` 至少包含：

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
coverage/
```

必须遵守以下规则：

- 真实 API Key 只存在于服务端环境变量中；
- 不要使用 `VITE_`、`NEXT_PUBLIC_` 等会暴露给浏览器的变量前缀保存密钥；
- 不要把 `.env`、日志中的密钥或完整敏感请求提交到 Git；
- 示例文件只保留变量名，不填写真实值。

## 7. 推荐目录结构

```text
week01-chat/
├── src/
│   └── index.ts
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

第 1 周先完成命令行版本。模型调用、Agent 循环和工具实现放在服务端代码中；Web 页面只调用自己的服务端 API，不直接携带模型密钥请求第三方模型服务。

## 8. 完成检查表

- [ ] Node.js 版本为 24.x；
- [ ] pnpm 版本为 11.x；
- [ ] `package.json` 包含 `packageManager` 和 `engines`；
- [ ] `pnpm-lock.yaml` 已提交；
- [ ] `pnpm typecheck` 能执行；
- [ ] `pnpm test` 能执行；
- [ ] `.env` 已被 Git 忽略；
- [ ] 浏览器端代码中不存在模型 API Key。
