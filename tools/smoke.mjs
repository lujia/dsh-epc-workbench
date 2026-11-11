/**
 * Headless render smoke test for the client half.
 *
 * The browser bucket only gives us `require('react')` at runtime, so this file
 * ships its own minimal hook-capable React stand-in: it renders every view once
 * per interesting state, with the real dataset, and fails on any thrown error.
 * It is a development aid (not part of the package) — run it after every edit:
 *
 *   node tools/smoke.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/* ------------------------------------------------------------------ React */

const HOOK_STACK = []
const OVERRIDES = {}
let renderLog = { errors: [], calls: 0 }

function currentFrame() {
  return HOOK_STACK[HOOK_STACK.length - 1]
}

function hookSlot() {
  const frame = currentFrame()
  if (frame === undefined) throw new Error('hook used outside a component')
  const index = frame.index
  frame.index += 1
  return { frame, index }
}

function useHookState(initial) {
  const { frame, index } = hookSlot()
  const override = OVERRIDES[frame.name]
  const value = override !== undefined && override[index] !== undefined ? override[index] : (typeof initial === 'function' ? initial() : initial)
  frame.values[index] = value
  const set = (next) => {
    // A single synchronous pass cannot re-render; record that React would have
    // scheduled one so a control wired to nothing still shows up in the log.
    frame.updates.push({ index, next })
  }
  return [value, set]
}

const React = {
  createElement(type, props, ...children) {
    const flat = []
    const push = (c) => {
      if (Array.isArray(c)) { c.forEach(push); return }
      if (c === null || c === undefined || c === false || c === true) return
      flat.push(c)
    }
    children.forEach(push)
    const next = Object.assign({}, props)
    if (flat.length === 1) next.children = flat[0]
    else if (flat.length > 1) next.children = flat
    return { __el: true, type, props: next }
  },
  useState: useHookState,
  useReducer(reducer, initial) { return useHookState(initial) },
  useEffect(effect) { hookSlot(); if (typeof effect === 'function') effect() },
  useLayoutEffect(effect) { hookSlot(); if (typeof effect === 'function') effect() },
  useMemo(factory) { hookSlot(); return factory() },
  useCallback(fn) { hookSlot(); return fn },
  useRef(initial) { const { frame, index } = hookSlot(); frame.values[index] = { current: initial }; return frame.values[index] },
  useContext() { return {} },
  memo(x) { return x },
  Fragment: '__fragment__',
}

/* --------------------------------------------------------------- renderer */

function renderNode(node, depth) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => renderNode(child, depth))
  if (!node.__el) return null
  const { type, props } = node
  if (typeof type === 'function') {
    const name = type.name || 'anonymous'
    const frame = { name, index: 0, values: [], updates: [] }
    HOOK_STACK.push(frame)
    let output
    try {
      output = type(props)
      renderLog.calls += 1
    } catch (error) {
      HOOK_STACK.pop()
      throw new Error(`${name}() failed: ${error && error.message ? error.message : String(error)}\n${error && error.stack ? error.stack.split('\n').slice(1, 4).join('\n') : ''}`)
    }
    HOOK_STACK.pop()
    return renderNode(output, depth + 1)
  }
  const children = props.children
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  return list.map((child) => renderNode(child, depth + 1))
}

function renderComponent(fn, props) {
  HOOK_STACK.length = 0
  return renderNode({ __el: true, type: fn, props: props || {} }, 0)
}

/* ------------------------------------------------------------------ setup */

const data = JSON.parse(await readFile(join(ROOT, 'data', 'workbench.json'), 'utf8'))
const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'))

const styleEl = { dataset: {}, textContent: '' }
const sandbox = {
  console,
  fetch: async (url) => ({ ok: true, status: 200, json: async () => (String(url).indexOf('/index') >= 0 ? index : data) }),
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild() {} },
  },
  window: {},
  addEventListener() {},
  removeEventListener() {},
}
sandbox.window = sandbox
sandbox.self = sandbox
sandbox.__ModuleLoader__ = { load(spec) { sandbox.__SPEC__ = spec } }

const source = await readFile(join(ROOT, 'client.js'), 'utf8')
const context = vm.createContext(sandbox)
vm.runInContext(source, context, { filename: 'client.js' })

const spec = sandbox.__SPEC__
if (!spec) throw new Error('client.js did not call window.__ModuleLoader__.load')
if (spec.id !== '@local/epc-workbench') throw new Error(`unexpected module id: ${spec.id}`)

const moduleExports = spec.factory((name) => {
  if (name === 'react') return React
  if (name === 'react/jsx-runtime') return { jsx: React.createElement, jsxs: React.createElement, Fragment: '__fragment__' }
  throw new Error(`unexpected require('${name}')`)
})

const captured = { row: null, page: null }
const fakeCtx = {
  get(name) {
    if (name === 'locale') {
      return {
        register: () => () => {},
        bind: () => (key, vars) => key,
      }
    }
    if (name === 'layout') return { selectPanel() {} }
    return undefined
  },
  effect(fn) { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
  slots: {
    inject(slotName, factory) { captured[slotName === 'main' ? 'page' : 'row'] = factory(); return () => {} },
    register(options, Component) { return Component },
  },
}

if (typeof moduleExports.apply !== 'function') throw new Error('client half exports no apply()')
moduleExports.apply(fakeCtx)

if (!captured.row) throw new Error('sidebar.panellist was not registered')
if (!captured.page) throw new Error('main page was not registered')

/* -------------------------------------------------------------- exercises */

// The captured slot values are the raw components (our ctx.slots.register stub
// returns the component), so pull them out of the module scope through a render
// of the shell instead.
const failures = []
function attempt(label, fn) {
  try {
    const out = fn()
    if (out === null || out === undefined) failures.push(`${label}: rendered nothing`)
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
  }
}

// Render the whole page shell (Workbench) in its ready state, then each view
// directly so every branch is reached without a live data fetch.
attempt('PanelIcon', () => renderComponent(captured.row, { size: 16, active: false }))

const SHELL_STATE = { status: 'ready', data, error: null }
const VIEWS = [
  ['overview', {}],
  ['commercial', {}],
  ['correspondence', {}],
  ['meetings', {}],
  ['quality', {}],
  ['documents', {}],
]
for (const [view, override] of VIEWS) {
  OVERRIDES.Workbench = [SHELL_STATE, view, false, false]
  for (const key of Object.keys(override)) OVERRIDES.Workbench[1] = view
  attempt(`Workbench(${view})`, () => renderComponent(captured.page, { ctx: fakeCtx, t: (k) => k, surface: 'page' }))
}

// Interactive states inside the commercial tabs and the list filters.
const STATES = [
  ['ViewCommercial ipcs P02', 'ViewCommercial', ['ipcs', 'P02']],
  ['ViewCommercial employer', 'ViewCommercial', ['employer', 'P02']],
  ['ViewCommercial retention P01', 'ViewCommercial', ['retention', 'P01']],
  ['ViewCommercial boq', 'ViewCommercial', ['boq', 'P02']],
  // main-contract scope: its four tabs, plus a subcontract tab left over from the
  // other scope, which must fall back instead of rendering an empty card.
  ['ViewCommercial main ipas', 'ViewCommercial', ['ipas', 'MAIN']],
  ['ViewCommercial main adjust', 'ViewCommercial', ['adjust', 'MAIN']],
  ['ViewCommercial main bills', 'ViewCommercial', ['bills', 'MAIN']],
  ['ViewCommercial main statement', 'ViewCommercial', ['statement', 'MAIN']],
  ['ViewCommercial main stale tab', 'ViewCommercial', ['boq', 'MAIN']],
  ['ViewQuality grade A', 'ViewQuality', ['A']],
  ['ViewQuality overdue', 'ViewQuality', ['all', 'all', true]],
  ['ViewCorrespondence code C', 'ViewCorrespondence', ['all', 'C']],
  ['ViewMeetings all books', 'ViewMeetings', ['all']],
]
for (const [label, name, values] of STATES) {
  OVERRIDES[name] = values
  attempt(label, () => {
    // Rendered through the shell so the view receives the same props as live.
    return renderComponent(captured.page, { ctx: fakeCtx, t: (k) => k, surface: 'page' })
  })
  delete OVERRIDES[name]
}

/* ---------------------------------------------------------------- report */

console.log(`components rendered: ${renderLog.calls}`)
if (failures.length > 0) {
  console.log(`\nFAILURES (${failures.length}):`)
  for (const line of failures) console.log(' - ' + line)
  process.exitCode = 1
} else {
  console.log('all views rendered without throwing')
}
