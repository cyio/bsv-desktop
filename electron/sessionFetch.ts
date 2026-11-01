/**
 * Route the main process's `fetch` through Electron's session network stack.
 *
 * Why this exists:
 * `@bsv/wallet-toolbox` builds its Arcade/ARC providers with `@bsv/sdk`'s
 * `defaultHttpClient()`, which uses `globalThis.fetch` when it exists (Node 18+).
 * Electron's main process is Node, so those calls use undici's fetch, and
 * undici does NOT read `HTTP_PROXY`/`HTTPS_PROXY` in this runtime. The result is
 * that the app's Network proxy setting (session.setProxy) was applied to
 * Chromium (renderer, fee policy, manifest) but not to the wallet's
 * `POST /tx` broadcast or `GET /tx/{txid}` status calls.
 *
 * `session.defaultSession.fetch` uses Chromium's network stack and therefore
 * honors `session.setProxy`, including `fixed_servers` and the local bypass
 * rules. Replacing global fetch before the wallet's Services are created makes
 * every wallet-toolbox HTTP call (Arcade first, fallbacks too) proxy-aware
 * without patching the toolbox.
 *
 * The monitor worker is a plain Node child and cannot use this; it installs an
 * undici `ProxyAgent`/`EnvHttpProxyAgent` instead (see monitor-worker.ts).
 */

import { session } from 'electron'

let installed = false

/** Idempotent; call after app.whenReady() and after the persisted proxy is applied. */
export function installSessionFetch(): void {
  if (installed) return

  const defaultSession = session?.defaultSession
  if (!defaultSession || typeof defaultSession.fetch !== 'function') {
    console.warn('[Network] session.fetch is unavailable; main-process fetch stays direct')
    return
  }

  installed = true
  const sessionFetch = defaultSession.fetch.bind(defaultSession)

  globalThis.fetch = ((...args: Parameters<typeof fetch>) =>
    sessionFetch(args[0] as any, args[1] as any)) as typeof fetch

  console.log('[Network] Main-process fetch routed through the Electron session (proxy-aware)')
}
