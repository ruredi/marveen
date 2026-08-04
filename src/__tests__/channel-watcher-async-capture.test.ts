import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf-8')
}

function count(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0
}

function readTypeScriptTree(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return [readTypeScriptTree(path)]
      return entry.isFile() && entry.name.endsWith('.ts') ? [readFileSync(path, 'utf-8')] : []
    })
    .join('\n')
}

describe('channel watcher async pane capture contract', () => {
  it('awaits every pane capture in the two assigned watcher files', () => {
    const monitor = read('web/channel-monitor.ts')
    const reconnect = read('web/channel-mcp-reconnect.ts')

    expect(count(monitor, /\bcapturePane\(/g)).toBe(0)
    expect(count(monitor, /\bcaptureParkedInputView\(/g)).toBe(0)
    expect(count(reconnect, /\bcapturePane\(/g)).toBe(0)

    expect(count(monitor, /\b(?:capturePaneAsync|captureParkedInputViewAsync)\(/g)).toBe(9)
    expect(count(monitor, /\bawait\s+(?:capturePaneAsync|captureParkedInputViewAsync)\(/g)).toBe(9)
    expect(count(reconnect, /\bcapturePaneAsync\(/g)).toBe(7)
    expect(count(reconnect, /\bawait\s+capturePaneAsync\(/g)).toBe(7)
  })

  it('acquires the channel-monitor single-flight guard before the first await and releases it in finally', () => {
    const monitor = read('web/channel-monitor.ts')
    const start = monitor.indexOf('let checkRunning = false')
    const end = monitor.indexOf('setTimeout(() => { void check() }', start)
    const check = monitor.slice(start, end)

    const guard = check.indexOf('if (checkRunning)')
    const acquire = check.indexOf('checkRunning = true')
    const tryBlock = check.indexOf('try {', acquire)
    const firstAwait = check.indexOf('await ', tryBlock)
    const finallyBlock = check.lastIndexOf('finally {')
    const release = check.lastIndexOf('checkRunning = false')

    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    expect(guard).toBeGreaterThanOrEqual(0)
    expect(acquire).toBeGreaterThan(guard)
    expect(tryBlock).toBeGreaterThan(acquire)
    expect(firstAwait).toBeGreaterThan(tryBlock)
    expect(finallyBlock).toBeGreaterThan(firstAwait)
    expect(release).toBeGreaterThan(finallyBlock)
  })

  it('keeps the request-path pane captures on the synchronous cached path', () => {
    const routeTree = readTypeScriptTree(join(SRC_ROOT, 'web', 'routes'))
    const agentsRoute = read('web/routes/agents.ts')

    expect(routeTree).not.toMatch(/capturePaneAsync|captureParkedInputViewAsync/)
    expect(count(agentsRoute, /\bcapturePane\(/g)).toBe(5)
    expect(agentsRoute).toContain('remotePaneCache.getOrRefresh')
  })
})
