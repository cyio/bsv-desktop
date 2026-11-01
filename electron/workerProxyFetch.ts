/**
 * Proxy-aware global fetch for the monitor worker.
 *
 * This file MUST be imported before any module that captures `globalThis.fetch`
 * at module-load time (notably `eventsource`), which is why monitor-worker.ts
 * imports it first.
 *
 * The worker is a plain Node child process, not an Electron renderer, so it has
 * no `session.defaultSession.fetch`. It inherits HTTP_PROXY/HTTPS_PROXY from the
 * parent (`networkSettings.ts` sets them), but Node's global fetch ignores those
 * variables. undici's `ProxyAgent` is the explicit equivalent here.
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici'

const proxyEnv =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
  process.env.https_proxy || process.env.http_proxy

if (proxyEnv) {
  try {
    const dispatcher = new ProxyAgent(proxyEnv)
    globalThis.fetch = ((...args: Parameters<typeof fetch>) =>
      undiciFetch(args[0] as any, {
        ...(args[1] as any),
        dispatcher
      } as any)) as typeof fetch
    console.log('[Monitor Worker] fetch routed through the configured proxy')
  } catch (error) {
    console.warn('[Monitor Worker] could not install proxy-aware fetch:', error)
  }
}

export {}
