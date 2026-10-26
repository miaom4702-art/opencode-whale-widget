/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const VERSION = "0.1.0"
const API_URL = "https://api.deepseek.com/user/balance"

const KV = {
  snapshot: "whale.snapshot",
  day: "whale.day",
  used: "whale.used",
  last: "whale.last",
  stamp: "whale.stamp",
} as const

type CurrencyInfo = {
  currency: string
  total: number
  granted: number
  topped: number
}

type Options = {
  pollMs?: number
  currency?: string
  apiKeyEnv?: string
}

function todayKey(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatMoney(value: number, currency = "CNY"): string {
  const symbol = currency === "USD" ? "$" : "¥"
  return `${symbol}${value.toFixed(2)}`
}

function clock(ts: number): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function short(text: string, max = 42): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function authFiles(): string[] {
  const files: string[] = []
  const home = homedir()
  if (home) files.push(join(home, ".local", "share", "opencode", "auth.json"))
  if (process.env.XDG_DATA_HOME) files.push(join(process.env.XDG_DATA_HOME, "opencode", "auth.json"))
  if (process.env.LOCALAPPDATA) files.push(join(process.env.LOCALAPPDATA, "opencode", "auth.json"))
  return files
}

function readKey(api: any, envName: string): string | undefined {
  const fromEnv = process.env[envName]?.trim()
  if (fromEnv) return fromEnv

  const configKey = api?.state?.config?.provider?.deepseek?.options?.apiKey
  if (typeof configKey === "string" && configKey.trim()) return configKey.trim()

  for (const file of authFiles()) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"))
      const key = parsed?.deepseek?.key
      if (typeof key === "string" && key.trim()) return key.trim()
    } catch {
      // try next location
    }
  }
  return undefined
}

async function fetchBalance(key: string): Promise<CurrencyInfo[]> {
  const res = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`余额接口 HTTP ${res.status}`)
  const data: any = await res.json()
  const raw = Array.isArray(data?.balance_infos) ? data.balance_infos : []
  const infos: CurrencyInfo[] = raw
    .map((info: any) => ({
      currency: String(info?.currency ?? "CNY"),
      total: Number(info?.total_balance ?? 0),
      granted: Number(info?.granted_balance ?? 0),
      topped: Number(info?.topped_up_balance ?? 0),
    }))
    .filter((info: CurrencyInfo) => Number.isFinite(info.total))
  if (!infos.length) throw new Error("余额数据为空")
  return infos
}

const tui: TuiPlugin = async (api, options) => {
  const opts = (options ?? {}) as Options
  const envName = opts.apiKeyEnv || "DEEPSEEK_API_KEY"
  const pollMs = Math.max(15_000, Number(opts.pollMs) || 60_000)

  const cached = api.kv.get<CurrencyInfo[] | null>(KV.snapshot, null)
  const [infos, setInfos] = createSignal<CurrencyInfo[]>(Array.isArray(cached) ? cached : [])
  const [used, setUsed] = createSignal<number>(Number(api.kv.get<number>(KV.used, 0)) || 0)
  const [stamp, setStamp] = createSignal<number>(Number(api.kv.get<number>(KV.stamp, 0)) || 0)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")

  const pick = (list: CurrencyInfo[]) =>
    list.find((item) => item.currency === (opts.currency || "CNY")) ?? list[0]

  const main = () => pick(infos())
  const balanceText = () => {
    const info = main()
    return info ? formatMoney(info.total, info.currency) : "—"
  }
  const todayText = () => formatMoney(used(), main()?.currency ?? "CNY")

  const refresh = async (manual = false) => {
    if (busy()) {
      if (manual) api.ui.toast({ variant: "info", title: "🐋 小鲸鱼", message: "正在刷新余额…" })
      return
    }
    setBusy(true)
    try {
      const key = readKey(api, envName)
      if (!key) throw new Error(`未找到 DeepSeek API Key（${envName}）`)
      const list = await fetchBalance(key)
      const info = pick(list)!
      const day = todayKey()
      const savedDay = api.kv.get<string>(KV.day, "")
      const last = api.kv.get<number | null>(KV.last, null)
      let todayUsed = savedDay === day ? Number(api.kv.get<number>(KV.used, 0)) || 0 : 0
      if (savedDay !== day) {
        todayUsed = 0
      } else if (typeof last === "number" && Number.isFinite(last) && info.total < last) {
        todayUsed += last - info.total
      }

      api.kv.set(KV.snapshot, list)
      api.kv.set(KV.day, day)
      api.kv.set(KV.used, todayUsed)
      api.kv.set(KV.last, info.total)
      api.kv.set(KV.stamp, Date.now())

      setInfos(list)
      setUsed(todayUsed)
      setStamp(Date.now())
      setError("")

      if (manual) {
        api.ui.toast({
          variant: "success",
          title: "🐋 小鲸鱼",
          message: `余额 ${formatMoney(info.total, info.currency)} · 今日 ${formatMoney(todayUsed, info.currency)}`,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      if (manual) api.ui.toast({ variant: "error", title: "🐋 小鲸鱼", message })
    } finally {
      setBusy(false)
    }
  }

  // Info-only widgets: a whale panel in the session sidebar and a compact
  // balance next to the landing-screen prompt.
  try {
    api.slots.register({
      order: 60,
      slots: {
        sidebar_content(ctx) {
          const theme = ctx.theme.current
          return (
            <box flexShrink={0} paddingTop={1} paddingBottom={1}>
              <text fg={theme.text}>
                <b>🐋 小鲸鱼记账</b>
              </text>
              <text fg={theme.accent}>{'   .-"""-.'}</text>
              <text fg={theme.accent}>{"  ( o  o )  ~"}</text>
              <text fg={theme.accent}>{"   `-----'"}</text>
              <text fg={theme.success}>余额 {balanceText()}</text>
              <text fg={theme.textMuted}>今日 {todayText()}</text>
              <text fg={error() ? theme.error : theme.textMuted}>
                {error()
                  ? `! ${short(error())}`
                  : stamp()
                    ? `刷新 ${clock(stamp())}`
                    : "正在摸鱼…"}
              </text>
              <text fg={theme.textMuted}>/whale 刷新 · v{VERSION}</text>
            </box>
          )
        },
        home_prompt_right(ctx) {
          const theme = ctx.theme.current
          return (
            <box paddingLeft={1} flexShrink={0}>
              <text fg={theme.textMuted}>🐋 {balanceText()}</text>
            </box>
          )
        },
        session_prompt_right(ctx) {
          const theme = ctx.theme.current
          return (
            <box paddingLeft={1} flexShrink={0}>
              <text fg={theme.textMuted}>🐋 {balanceText()}</text>
            </box>
          )
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    api.ui.toast({ variant: "error", title: "🐋 小鲸鱼", message: `挂件加载失败：${message}` })
  }

  // /whale — refresh and toast the current balance.
  try {
    api.keymap.registerLayer({
      commands: [
        {
          name: "whale.balance.refresh",
          title: "小鲸鱼记账：刷新 DeepSeek 余额",
          category: "Plugin",
          namespace: "palette",
          slashName: "whale",
          run: () => {
            void refresh(true)
          },
        },
      ],
    })
  } catch {
    // Fallback for older runtimes without keymap layers.
    if (api.command) {
      try {
        api.command.register(() => [
          {
            title: "小鲸鱼记账：刷新 DeepSeek 余额",
            value: "whale.balance.refresh",
            category: "Plugin",
            slash: { name: "whale" },
            onSelect: () => {
              void refresh(true)
            },
          },
        ])
      } catch {
        // ignore command registration errors
      }
    }
  }

  void refresh()

  const timer = setInterval(() => {
    void refresh()
  }, pollMs)
  api.lifecycle.onDispose(() => clearInterval(timer))

  try {
    const off = api.event.on("session.idle", () => {
      void refresh()
    })
    api.lifecycle.onDispose(off)
  } catch {
    // event bus unavailable; polling still keeps the widget fresh
  }
}

const plugin: TuiPluginModule = {
  id: "whale-widget",
  tui,
}

export { tui }
export default plugin
