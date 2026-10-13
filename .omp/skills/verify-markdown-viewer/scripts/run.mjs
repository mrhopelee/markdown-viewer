#!/usr/bin/env node
// Drive a tab in a launched Markdown Viewer verification instance over CDP.
//
// Usage:
//   node run.mjs --state <state.json> --url <url> [--eval '<js>'] [--shot <png>] [--wait-ms <ms>]
//
// Prints a JSON verdict on stdout: { ok, url, eval, shot }.
// eval is the JSON-decoded result of --eval when supplied, shot is the written PNG path.
//
// Exits 0 on success, 1 on failure.

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
function arg (name, fallback) {
  const i = argv.indexOf(name)
  return i === -1 ? fallback : argv[i + 1]
}
function has (name) { return argv.includes(name) }

const statePath = arg('--state')
const url = arg('--url')
const expr = arg('--eval')
const shot = arg('--shot')
const waitMs = parseInt(arg('--wait-ms', '2500'), 10)

if (!statePath || !url) {
  console.error('run.mjs: --state and --url are required')
  process.exit(1)
}

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const port = state.port

function connect (wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const listeners = new Map()
    ws.addEventListener('open', () => resolve(api))
    ws.addEventListener('error', (e) => reject(new Error('ws error: ' + (e.message || ''))))
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id)
        pending.delete(m.id)
        if (m.error) rej(new Error(m.error.message))
        else res(m.result)
      }
      if (m.method && listeners.has(m.method)) {
        for (const fn of listeners.get(m.method)) fn(m.params)
      }
    })
    const api = {
      send (method, params = {}, sessionId) {
        return new Promise((res, rej) => {
          const mid = ++id
          pending.set(mid, { res, rej })
          ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }))
        })
      },
      on (method, fn) {
        if (!listeners.has(method)) listeners.set(method, [])
        listeners.get(method).push(fn)
      },
      close () { ws.close() },
    }
  })
}

const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
const browser = await connect(version.webSocketDebuggerUrl)

// Attach to the first page target, or create one.
const { targetInfos } = await browser.send('Target.getTargets')
let pageTarget = targetInfos.find((t) => t.type === 'page')
if (!pageTarget) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  pageTarget = { targetId }
}
const { sessionId } = await browser.send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true })

await browser.send('Page.enable', {}, sessionId)
await browser.send('Page.navigate', { url }, sessionId)

// Wait: the extension injects content scripts asynchronously after the tab loads.
await new Promise((r) => setTimeout(r, waitMs))

const out = { ok: true, url }

if (expr) {
  const r = await browser.send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId)
  if (r.exceptionDetails) {
    out.ok = false
    out.evalError = r.exceptionDetails.text || 'evaluation threw'
  } else {
    out.eval = r.result.value
  }
}

if (shot) {
  const r = await browser.send('Page.captureScreenshot', { format: 'png' }, sessionId)
  fs.mkdirSync(path.dirname(shot), { recursive: true })
  fs.writeFileSync(shot, Buffer.from(r.data, 'base64'))
  out.shot = shot
}

console.log(JSON.stringify(out, null, 2))
browser.close()
process.exit(out.ok ? 0 : 1)
