import { spawn } from "node:child_process"
import open from "open"

/**
 * The `$BROWSER` command for a URL, or undefined to use the platform opener.
 *
 * Mirrors the contract of the Rust `webbrowser` crate (which Codex uses):
 * colon-separated candidates, whitespace-separated arguments, `%s` for the URL,
 * appended when absent. Windows is left alone: its default opener works and the
 * variable is a Unix convention.
 */
export function browserCommand(
  url: string,
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") return
  const value = env.BROWSER?.trim()
  if (!value) return
  for (const entry of value.split(":")) {
    const parts = entry.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) continue
    let placed = false
    const args = parts.slice(1).map(part => {
      if (!part.includes("%s")) return part
      placed = true
      // A function replacement keeps `$&` and friends in the URL literal.
      return part.replaceAll("%s", () => url)
    })
    if (!placed) args.push(url)
    return { command: parts[0], args }
  }
}

export function openUrl(input: string) {
  const url = URL.canParse(input) ? new URL(input) : undefined
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:"))
    return Promise.reject(new Error(`Only http and https links can be opened in the browser: ${input}`))

  const browser = browserCommand(url.href)
  if (!browser) return open(url.href).then(() => {})

  return new Promise<void>((resolve, reject) => {
    const child = spawn(browser.command, browser.args, { stdio: "ignore", detached: true })
    child.once("spawn", () => {
      child.unref()
      resolve()
    })
    child.once("error", () => {
      open(url.href).then(() => resolve(), reject)
    })
  })
}

export function openPath(path: string) {
  return open(path)
}
