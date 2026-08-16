# 新机器同步指南

在一台新电脑上恢复 DeepSeek Harness 运行环境（含本仓库的插件）。

## 需要带走什么

| 来源 | 内容 | 能否进 git |
|---|---|---|
| 本仓库 | 插件代码 | 已在 git 中 |
| `~/.dsh/settings.yaml` | 模型路由 + 默认模型 | 可以，不含密钥（只存变量名如 `apiKeyEnv: ARK_API_KEY`） |
| `~/.dsh/.credentials.yaml` | API Key 明文 | **不可以**，手动拷贝或用密码管理器 |

`~/.dsh` 下其余文件均无需同步：

- `profiles/*/cordis.yml`、`pnpm-workspace.yaml` —— 首次启动自动生成的模板
- `profiles/*/package.json` —— 由第 4 步的 `dsh plugin add` 生成。**不要拷贝旧的**，其中 `link:` 是写死的绝对路径，换机器即坏链
- `profiles/web/cordis.patch.yml` —— 自定义补丁层，若为空 `[]` 则无内容可带
- `profiles/web/pnpm-lock.yaml` —— 改用 `link:` 后已无作用
- `sessions/` —— 历史会话。目录名按 workspace 绝对路径编码，新机器路径不同则不会归入对应 workspace
- `storages/` —— 缓存与 workspace 索引，内含绝对路径，拷过去会指向不存在的目录
- `.anonymous-user-id` —— 遥测用随机 UUID，建议让新机器生成新的

## 步骤

### 1. 准备运行时

需要 Node `^22.19.0 || >=24.0.0`，包管理器 pnpm（版本由 harness 的 `packageManager` 字段锁定）。

```sh
node -v                                    # 确认满足版本要求
corepack enable pnpm --install-directory /opt/homebrew/bin
```

harness 的部分构建脚本内部直接调用 `pnpm`，因此 shim 必须落在 `PATH` 上，不能只靠 `corepack pnpm` 前缀。

### 2. 安装 harness

```sh
cd <harness 源码目录>
pnpm install
pnpm run build
pnpm dsh --version
```

若 `pnpm install` 因下载慢而超时，改用：

```sh
pnpm install --fetch-timeout 900000 --network-concurrency 2 --fetch-retries 5
```

### 3. 取插件仓库

```sh
cd ~/Desktop/workspace
git clone git@github.com:Duleey/dsh-plugin.git
```

用 SSH 而非 HTTPS：部分网络环境下 GitHub 的 HTTPS 通道不通而 SSH 22 端口可用。需先把该机器的公钥加到 GitHub 账号，用 `ssh -T git@github.com` 验证。

插件包没有 `dependencies`，clone 后**不需要** `pnpm install`。

### 4. 挂载插件

```sh
cd <harness 源码目录>
pnpm dsh plugin --profile web add link:$HOME/Desktop/workspace/dsh-plugin/dsh-deepseek-quota-left
```

这一条命令完成三件事：不存在时按模板初始化 `web` profile（`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`）、把插件写入 `dependencies`、把插件名追加进 `dsh.profile.bundles`。前者决定「装到哪」，后者决定「是否加载」，缺一不可。

`link:` 是软链而非拷贝：直接编辑本仓库内的文件即刻生效，且 `pnpm install` 不会覆盖。代价是 profile 的 `package.json` 里记录的是绝对路径，所以每台机器都要重跑这条命令。

路径按新机器实际情况调整。`dsh plugin` 需要 `pnpm` 在 `PATH` 上（第 1 步已保证）。

### 5. 放配置

```sh
mkdir -p ~/.dsh
cp <来源>/settings.yaml ~/.dsh/
cp <来源>/.credentials.yaml ~/.dsh/
chmod 600 ~/.dsh/.credentials.yaml
```

`chmod` 不能省：`cp`/`scp` 不保证保留权限位。

`.credentials.yaml` 格式为扁平的 `KEY: value`，键名要与 `settings.yaml` 里 `apiKeyEnv` 声明的一致：

```yaml
ARK_API_KEY: <火山方舟 key>
DEEPSEEK_API_KEY: <DeepSeek key>
```

凭据查找优先级为：环境变量 > `~/.dsh/.credentials.yaml` > 调用目录 `.env` > `~/.dsh/.env`。

### 6. 验证

```sh
cd <harness 源码目录>
pnpm dsh --profile headless "say ok"   # 验模型链路，应返回 ok
pnpm dsh web                            # 验插件加载，访问 http://127.0.0.1:3080
```

Web 页面不报 `Failed to load plugins`、右下角出现配额卡片即成功。

## 常见问题

**`Failed to load plugins ... loaded without registering "<包名>" via __ModuleLoader__.load`**

`lib/client.js` 中 `__ModuleLoader__.load({ id })` 的 `id` 必须与 `package.json` 的 `name` 完全一致。本仓库的插件已修正此项，fork 其他插件时需注意。

**`dsh plugin` 报 `pnpm not found on PATH`**

回到第 1 步装 shim。

**切换 LLM 后端**

只改 `~/.dsh/settings.yaml` 末尾两行，热重载生效，无需重启：

```yaml
agent-default-model:
  provider: deepseek-official   # 或 settings.yaml 中 llm-pi-ai.providers 下的某个键
  model: deepseek-v4-flash
```

`deepseek-official` 由内置适配器提供，路由名固定，无需在 `llm-pi-ai` 段落中声明。

**插件位置能否换到别处**

可以。`link:` 指向哪里都行，换位置后重跑第 4 步即可。`~/.dsh` 本身的位置由 `DSH_HOME` 环境变量决定（默认 `~/.dsh`），但 `profiles/<name>` 这两级路径是硬编码的。
