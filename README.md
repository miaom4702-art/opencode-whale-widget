# opencode-whale-widget

DeepSeek 余额小鲸鱼挂件，住在 **opencode TUI** 里。

在命令行里写代码时，不用切到浏览器或 DeepSeek 控制台，就能随时看到账户余额和今天大概花了多少钱。

> 非官方社区项目，与 DeepSeek、opencode 官方无隶属关系。
> 灵感来自 DSH 插件 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT）。本项目是独立的 opencode TUI 实现，未复制原仓库代码，也未包含其图片/音频资源。详见 [版权与致谢](#版权与致谢)。

---

## 1. 解决什么问题

用 opencode 跑 DeepSeek 模型时，余额和消耗只能去网页控制台看，容易忘记充值，或者长任务跑完才发现花了不少钱。

这个插件把余额直接放进终端：

- 首页和会话输入框旁边常驻显示 `🐋 ¥余额`
- 会话侧边栏显示余额、今日已用、最后刷新时间
- 输入 `/whale` 立即刷新并弹出提示

不改变 opencode 的对话逻辑，只做本地展示。

## 2. 主要功能

- **侧边栏小鲸鱼面板**：ASCII 小鲸鱼 + 余额 + 今日已用 + 刷新时间
- **输入框右侧余额**：首页和会话页都显示紧凑的 `🐋 ¥xx.xx`
- **`/whale` 命令**：手动刷新，并通过 toast 显示余额和今日已用
- **自动刷新**：默认每 60 秒请求一次 DeepSeek 余额接口；会话进入空闲时也会刷新
- **今日已用估算**：按余额下降量累计，充值/赠金增加不会被算成消费；按北京时间（UTC+8）跨天重置
- **本地缓存**：启动时先显示上次余额；网络抖动时保留最近一次数据并显示错误原因
- **多币种**：默认显示 CNY；可配置为 USD，找不到对应币种时回退到接口返回的第一个币种
- **不落盘密钥**：API Key 只在本机读取，仅用于请求 `api.deepseek.com`，不会写进配置、日志或本项目的数据文件

> 注意：本项目是纯文本 TUI 挂件，没有图片、动画、音效或拖拽。原 DSH 鲸鱼挂件的这些能力不在本项目范围内。

## 3. 安装方法

### 前置条件

- 已安装 [opencode](https://opencode.ai)，并支持 TUI 插件（`tui.json` + slots）。本项目在 **opencode 1.19.4 / Windows** 上测试通过。
- Node.js 22+ 与 npm（仅用于安装插件依赖；插件本身运行在 opencode 自带的 Bun 运行时里）。
- 一个 DeepSeek API Key。可以在 opencode 里用 `opencode auth login` 选择 DeepSeek 登录，或设置环境变量 `DEEPSEEK_API_KEY`。

### 步骤

1. 把仓库克隆到一个固定目录（不要放临时目录）：

   **Windows PowerShell**

   ```powershell
   git clone https://github.com/miaom4702-art/opencode-whale-widget.git "$HOME\.config\opencode\whale-widget"
   cd "$HOME\.config\opencode\whale-widget"
   npm install
   ```

   **macOS / Linux**

   ```bash
   git clone https://github.com/miaom4702-art/opencode-whale-widget.git ~/.config/opencode/whale-widget
   cd ~/.config/opencode/whale-widget
   npm install
   ```

2. 编辑 `~/.config/opencode/tui.json`（Windows 为 `C:\Users\<你>\.config\opencode\tui.json`）。文件不存在就新建：

   ```json
   {
     "$schema": "https://opencode.ai/tui.json",
     "plugin": ["./whale-widget/src/index.tsx"]
   }
   ```

   如果文件里已经有其他插件，把 `"./whale-widget/src/index.tsx"` 追加到 `plugin` 数组即可。

3. 完全退出 opencode 再重新打开。挂件会在启动后自动取一次余额。

> 插件目录路径是相对 `tui.json` 解析的，安装后不要随意移动/重命名 `whale-widget` 目录；移动后需要同步修改 `tui.json`。

### 升级

```powershell
cd "$HOME\.config\opencode\whale-widget"
git pull
npm install
```

然后重启 opencode。

### 卸载

删除 `tui.json` 里对应的插件条目（或把 `plugin` 改成 `[]`），再删除插件目录即可。本地缓存的 `whale.*` 键可以留在 `~/.local/state/opencode/kv.json` 里，不影响使用。

## 4. 使用方法

安装并重启 opencode 后：

- **首页**：输入框右侧出现 `🐋 ¥18.38`
- **会话页**：输入框右侧继续显示余额；右侧边栏出现小鲸鱼面板
- **手动刷新**：在输入框输入 `/whale`，或打开命令面板选择「小鲸鱼记账：刷新 DeepSeek 余额」
- **自动刷新**：默认 60 秒一次；每轮对话结束、会话空闲时也会刷新

### 配置项（可选）

`plugin` 支持 `[路径, 配置对象]` 形式：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "./whale-widget/src/index.tsx",
      {
        "pollMs": 60000,
        "currency": "CNY",
        "apiKeyEnv": "DEEPSEEK_API_KEY"
      }
    ]
  ]
}
```

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `pollMs` | `60000` | 自动刷新间隔（毫秒），最小 15000 |
| `currency` | `"CNY"` | 优先显示的币种；接口没有该币种时回退到第一个 |
| `apiKeyEnv` | `"DEEPSEEK_API_KEY"` | 优先从这个环境变量读取 API Key |

### API Key 读取顺序

1. `apiKeyEnv` 指定的环境变量（默认 `DEEPSEEK_API_KEY`）
2. opencode 配置里的 `provider.deepseek.options.apiKey`
3. opencode 凭据文件 `~/.local/share/opencode/auth.json` 里的 `deepseek.key`（即 `opencode auth login` 写入的密钥）

三个来源都没有时，侧边栏会显示 `未找到 DeepSeek API Key`，不会影响 opencode 本身使用。

## 5. 输入输出示例

### 示例 1：手动刷新

**输入**

```text
/whale
```

**输出（toast）**

```text
🐋 小鲸鱼
余额 ¥18.38 · 今日 ¥0.12
```

### 示例 2：侧边栏面板

> 余额为示例值，实际以你的账户为准。窄侧边栏里可能自动换行。

```text
🐋 小鲸鱼记账
   .-"""-.
  ( o  o )  ~
   `-----'
余额 ¥18.38
今日 ¥0.12
刷新 14:31
/whale 刷新 · v0.1.0
```

### 示例 3：余额接口请求 / 返回

插件内部请求：

```http
GET https://api.deepseek.com/user/balance
Authorization: Bearer $DEEPSEEK_API_KEY
```

DeepSeek 返回（示例）：

```json
{
  "is_available": true,
  "balance_infos": [
    {
      "currency": "CNY",
      "total_balance": "18.38",
      "granted_balance": "0.00",
      "topped_up_balance": "18.38"
    },
    {
      "currency": "USD",
      "total_balance": "0.00",
      "granted_balance": "0.00",
      "topped_up_balance": "0.00"
    }
  ]
}
```

插件会取 `total_balance` 作为「余额」，把相邻两次余额的下降量累加到「今日已用」。

### 示例 4：错误提示

没有配置 Key 时：

```text
🐋 小鲸鱼
未找到 DeepSeek API Key（DEEPSEEK_API_KEY）
```

网络或接口异常时，侧边栏保留上一次缓存的余额，并显示类似：

```text
! 余额接口 HTTP 500
```

## 项目结构

```text
opencode-whale-widget/
├── src/index.tsx    # 插件本体（TUI slots + /whale + 余额记账）
├── package.json
├── tsconfig.json
├── LICENSE
├── README.md
└── .gitignore
```

## 隐私与安全

- API Key 只在本机读取，仅发送到 DeepSeek 官方余额接口 `https://api.deepseek.com/user/balance`。
- Key 不会写入 `tui.json`、README、日志或本地缓存。
- 本地只保存余额快照、日期、今日已用等数字，用于重启后继续显示和跨天统计。
- 本项目不收集遥测，不上传任何数据。

## 已知限制

- 目前只在 opencode 1.19.4（Windows）上验证；opencode 的 TUI 插件 API 仍在演进，其他版本可能需要调整。
- 「今日已用」是通过余额差估算的，不是 DeepSeek 官方账单；充值、赠送金额、同时运行多个 opencode 实例都可能让数字有偏差。
- 侧边栏宽度较窄时 ASCII 小鲸鱼和文字可能换行。
- 余额接口不可用时只能显示缓存值，无法离线计算真实余额。

## 版权与致谢

- 本项目是 opencode TUI 的独立实现，灵感来自 DSH 插件 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT License）。
- 本项目未复制上述仓库的源代码，也未包含其图片、动图或音频资源；仅参考了「在界面里显示 DeepSeek 余额」这一产品思路。
- 实现过程中参考了社区 opencode TUI 插件的公开 API 用法（例如 [ds-peak-warningx](https://github.com/Bashar-AlGhada/opencode-ds-peak-warning)，MIT License）；未复制其业务代码。
- “DeepSeek” 是其权利人的商标；本项目与 DeepSeek、opencode 官方均无隶属或背书关系。
- 本项目代码以 **MIT License** 发布，详见 [LICENSE](./LICENSE)。
