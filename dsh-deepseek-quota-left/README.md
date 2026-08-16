# dsh-deepseek-quota-left

DeepSeek API 额度面板插件（DSH web GUI 修改版）。

基于 [dsh-deepseek-quota](https://github.com/yingjunnan/dsh-deepseek-quota)（MIT）修改：把右下角浮动卡片改为**左侧折叠式面板**，并修复了"今日已消费"来源标识未传递到前端的问题。

## 特性

- **左侧折叠把手**：默认只显示一条竖排"额度"把手贴在聊天界面左边框，点击展开完整面板，再点收起。
- **官方精确数据**：
  - 余额：官方 `api.deepseek.com/user/balance`（无需额外配置）
  - 今日已消费：配置 `DEEPSEEK_PLATFORM_TOKEN` 后走官方平台用量接口，显示"今日已消费"（不带 ≈）；未配置时回退为余额差值估算（带 ≈）
  - 当前对话费用：按官方价格表（含峰谷计价）本地实时计价，悬停 ⓘ 查看公式明细
- 自动刷新（余额 60s / 对话费用 5s）+ 手动刷新按钮。
- 跟随明暗主题，API Key 不出本机。

## 安装

需要 DSH CLI 与 [pnpm](https://pnpm.io/installation)。

```sh
# 从 npm 安装
dsh plugin --profile web add dsh-deepseek-quota-left

# 或从 GitHub 仓库安装
dsh plugin --profile web add https://github.com/dk33333333/dsh-deepseek-quota-left
```

然后：

1. 重启 `dsh web`（bundle 层在启动时读取）。
2. 打开 http://127.0.0.1:3080 并刷新页面。
3. 左侧边框出现竖排"额度"把手，点击展开面板。

## 配置

插件读取 DSH 已使用的 `DEEPSEEK_API_KEY`（余额）。如需官方精确"今日已消费"，另配 `DEEPSEEK_PLATFORM_TOKEN`：

1. 登录 https://platform.deepseek.com
2. DevTools → Console 运行 `localStorage.getItem('userToken')`，复制 JSON 中 `value` 字段
3. 写入 `~/.dsh/.credentials.yaml`：

```yaml
DEEPSEEK_PLATFORM_TOKEN: <token>
```

## 与原版的差异

| 项 | 原版 | 本修改版 |
|---|---|---|
| 位置 | 右下角浮动卡片 | 左侧边框折叠把手，点击展开 |
| 今日已消费来源标识 | 前端丢失 `todayConsumedSource`，永远显示"约" | 已修复，官方数据时显示"已消费" |

## License

MIT（派生自 [dsh-deepseek-quota](https://github.com/yingjunnan/dsh-deepseek-quota)，MIT）
