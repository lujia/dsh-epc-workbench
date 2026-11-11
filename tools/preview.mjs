/**
 * Static visual preview: renders the workbench to HTML so the page can be
 * screenshotted with a headless browser. Development aid only, not shipped.
 *
 *   node tools/preview.mjs            -> all views
 *   node tools/preview.mjs commercial -> one view
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const OUT = join(ROOT, 'preview')
// The preview pages are scratch output; a fresh checkout has no such folder.
await mkdir(OUT, { recursive: true })

/* ------------------------------------------------------------------ React */

const HOOK_STACK = []
const OVERRIDES = {}
const CLEANUPS = []

function hookSlot() {
  const frame = HOOK_STACK[HOOK_STACK.length - 1]
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
  return [value, () => {}]
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
  // Effects must run: useIndex() starts the index fetch from one.
  useEffect(effect) { hookSlot(); if (typeof effect === 'function') { const cleanup = effect(); if (typeof cleanup === 'function') CLEANUPS.push(cleanup) } },
  useLayoutEffect(effect) { hookSlot(); if (typeof effect === 'function') { const cleanup = effect(); if (typeof cleanup === 'function') CLEANUPS.push(cleanup) } },
  useMemo(factory) { hookSlot(); return factory() },
  useCallback(fn) { hookSlot(); return fn },
  useRef(initial) { const { frame, index } = hookSlot(); frame.values[index] = { current: initial }; return frame.values[index] },
  useContext() { return {} },
  memo(x) { return x },
  Fragment: '__fragment__',
}

/* ---------------------------------------------------------------- renderer */

const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'path', 'circle', 'rect', 'line', 'polyline'])
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function attrName(key) {
  if (key === 'className') return 'class'
  if (key === 'htmlFor') return 'for'
  if (key === 'children') return null
  if (key === 'key') return null
  return key
}

function styleText(style) {
  if (style === null || style === undefined || typeof style !== 'object') return null
  return Object.keys(style).map((k) => {
    const prop = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    return prop + ':' + style[k]
  }).join(';')
}

function renderNode(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return esc(node)
  if (Array.isArray(node)) return node.map(renderNode).join('')
  if (!node.__el) return ''
  const { type, props } = node

  if (typeof type === 'function') {
    const name = type.name || 'anonymous'
    const frame = { name, index: 0, values: [] }
    HOOK_STACK.push(frame)
    let output
    try {
      output = type(props)
    } finally {
      HOOK_STACK.pop()
    }
    return renderNode(output)
  }

  const tag = type === '__fragment__' ? null : type
  const inner = renderNode(props.children)
  if (tag === null) return inner

  let attrs = ''
  for (const raw of Object.keys(props)) {
    const key = attrName(raw)
    if (key === null) continue
    let value = props[raw]
    if (key === 'style') value = styleText(value)
    if (value === null || value === undefined || typeof value === 'function' || typeof value === 'object') continue
    attrs += ' ' + key + '="' + esc(value) + '"'
  }
  if (VOID.has(tag)) return '<' + tag + attrs + '>'
  return '<' + tag + attrs + '>' + inner + '</' + tag + '>'
}

/* ------------------------------------------------------------------ setup */

const data = JSON.parse(await readFile(join(ROOT, 'data', 'workbench.json'), 'utf8'))
const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'))

const sandbox = {
  console,
  // Serve the same payloads the host routes do: the index route is separate.
  fetch: async (url) => ({ ok: true, status: 200, json: async () => (String(url).indexOf('/index') >= 0 ? index : data) }),
  setTimeout, clearTimeout, setInterval, clearInterval,
  addEventListener() {}, removeEventListener() {},
  document: { querySelector: () => null, createElement: () => ({ dataset: {}, textContent: '' }), head: { appendChild() {} } },
}
sandbox.window = sandbox
sandbox.self = sandbox
sandbox.__ModuleLoader__ = { load(spec) { sandbox.__SPEC__ = spec } }

const source = await readFile(join(ROOT, 'client.js'), 'utf8')
vm.runInContext(source, vm.createContext(sandbox), { filename: 'client.js' })

const captured = {}
const REGISTRY = {}
const LANG = process.argv.slice(2).indexOf('zh') >= 0 ? 'zh' : 'en'
const fakeCtx = {
  get(name) {
    // Bind the locale service so the shell resolves its own dictionary; without it
    // the plugin silently falls back to its built-in English table.
    if (name !== 'locale') return undefined
    return {
      register(namespace, dicts) { REGISTRY[namespace] = dicts; return () => { delete REGISTRY[namespace] } },
      bind(namespace) {
        return (key) => {
          const dicts = REGISTRY[namespace] || REGISTRY[Object.keys(REGISTRY)[0]] || {}
          const table = dicts[LANG] || {}
          return table[key] != null ? table[key] : key
        }
      },
      getLocale() { return LANG },
    }
  },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  slots: {
    inject(slot, factory) { captured[slot === 'main' ? 'page' : 'row'] = factory(); return () => {} },
    register(_options, Component) { return Component },
  },
}
sandbox.__SPEC__.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require ' + name)
}).apply(fakeCtx)

// CSS is captured by the style element our injectCss() creates.
const css = (sandbox.__CSS__ || '')
const CSS = css
  || (await readFile(join(ROOT, 'src', 'client', '10_css.js'), 'utf8'))
    .replace(/^[\s\S]*?String\.raw`/, '')
    .replace(/`[\s\S]*$/, '')

const VIEWS = ['overview', 'commercial', 'correspondence', 'meetings', 'quality', 'documents']
// A tab name in the argv selects one of the commercial tabs inside the page;
// 'sub' forces the P01/P02 subcontract scope instead of the main contract.
const COM_TABS = ['ipas', 'adjust', 'bills', 'statement', 'ipcs', 'employer', 'retention', 'boq']
const flags = process.argv.slice(2)
const only = flags.find((a) => VIEWS.indexOf(a) >= 0)
const tabFlag = flags.find((a) => COM_TABS.indexOf(a) >= 0)
const subScope = flags.indexOf('sub') >= 0
const theme = flags.indexOf('light') >= 0 ? 'light' : 'dark'
const targets = only ? [only] : VIEWS

for (const view of targets) {
  OVERRIDES.Workbench = [{ status: 'ready', data, error: null }, view, false, false]
  // Workbench state order is (state, view, mini, palette, scope) — the scope slot
  // applies to every view, the commercial tab only to that one.
  OVERRIDES.Workbench[4] = subScope ? 'P02' : 'MAIN'
  if (view === 'commercial') {
    // The tab lives inside ViewCommercial, whose hook order is (tab, scopeLocal).
    OVERRIDES.ViewCommercial = [tabFlag || (subScope ? 'ipcs' : 'ipas'), subScope ? 'P02' : 'MAIN']
  }
  // useIndex() is a plain function, not a component, so it cannot be overridden
  // by name. Instead render once to trigger its fetch, let the promise settle
  // into the module-level cache, then render again with the cache populated.
  renderNode({ __el: true, type: captured.page, props: { ctx: fakeCtx, t: (k) => k, surface: 'page' } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const html = renderNode({ __el: true, type: captured.page, props: { ctx: fakeCtx, t: (k) => k, surface: 'page' } })
  const page = `<!doctype html>
<html lang="en" data-theme="${theme}"><head><meta charset="utf-8">
<title>EPC Workbench — ${view}</title>
<style>
:root{${theme === 'light' ? `
  --dsw-alias-bg-base:#f4f5f7; --dsw-alias-bg-layer-1:#ffffff; --dsw-alias-bg-layer-2:#eceef1;
  --dsw-alias-bg-layer-3:#e3e6ea; --dsw-alias-border-l1:#d6d9de; --dsw-alias-border-l2:#c3c8cf;
  --dsw-alias-brand-primary:#2f6fed; --dsw-alias-label-primary:#1d1f23; --dsw-alias-label-secondary:#5f6368;
  --dsw-alias-label-tertiary:#6f747a; --dsw-alias-state-error-primary:#c8402f; --dsw-alias-state-success-primary:#1f9d57;
  --dsw-alias-state-warn-primary:#b8860b; --dsw-alias-interactive-bg-hover:#eef1f5; --dsw-alias-accent-soft:#dce8ff;
` : `
  --dsw-alias-bg-base:#1e1f22; --dsw-alias-bg-layer-1:#2b2d31; --dsw-alias-bg-layer-2:#25272b;
  --dsw-alias-bg-layer-3:#34373d; --dsw-alias-border-l1:#16171a; --dsw-alias-border-l2:#3a3d44;
  --dsw-alias-brand-primary:#4a8cff; --dsw-alias-label-primary:#e7e7e7; --dsw-alias-label-secondary:#c2c6cc;
  --dsw-alias-label-tertiary:#9aa0a6; --dsw-alias-state-error-primary:#e2554a; --dsw-alias-state-success-primary:#33d17a;
  --dsw-alias-state-warn-primary:#ffd479; --dsw-alias-interactive-bg-hover:#34373d; --dsw-alias-accent-soft:#23304d;
`}}
html,body{margin:0;height:100%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
#host{position:fixed;inset:0;display:flex;overflow:hidden}
#host>*{flex:1;min-width:0}
.pv-label{position:fixed;left:8px;top:2px;font:10px/1 ui-monospace,Consolas,monospace;color:#2f6fed;opacity:.4;pointer-events:none}
</style>
<style>${CSS}</style></head>
<body><div id="host">${html}</div><div class="pv-label">${theme}/${view}</div></body></html>`
  const file = join(OUT, view + (view === 'commercial' && (tabFlag || subScope) ? '.' + (subScope ? 'sub' : 'main') + '.' + (tabFlag || (subScope ? 'ipcs' : 'ipas')) : (subScope ? '.sub' : '')) + (LANG === 'zh' ? '.zh' : '') + (theme === 'light' ? '.light' : '') + '.html')
  await writeFile(file, page, 'utf8')
  console.log('wrote ' + file + ' (' + page.length + ' B)')
}
