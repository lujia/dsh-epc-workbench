/**
 * i18n key audit: every t('...') key used by the client must exist in EN and ZH.
 * Development aid only, not shipped.   node tools/check_i18n.mjs
 */
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src', 'client')

const files = (await readdir(SRC)).filter((f) => f.endsWith('.js')).sort()
let source = ''
for (const f of files) source += '\n' + (await readFile(join(SRC, f), 'utf8'))

const used = new Set()
// Skip partially-built keys such as t('view.' + id): the prefix is not a key.
for (const m of source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
  if (!m[1].endsWith('.')) used.add(m[1])
}

// Keys assembled at runtime from a known set of suffixes. Series and meeting
// labels are not here: they come from the dataset taxonomy, not from the
// dictionary, so a project can name its own series without touching i18n.
for (const v of ['overview', 'commercial', 'correspondence', 'meetings', 'quality', 'documents']) used.add('view.' + v)
for (const v of ['project', 'delivery', 'records']) used.add('cluster.' + v)
for (const v of ['L', 'M', 'D', 'I', 'C', 'S']) used.add('kind.' + v)
for (const v of ['c', 'e', 'm']) used.add('ql.disc.' + v)
// Contract roles the register strip can print, whatever the project calls them.
for (const v of ['employer', 'contractor', 'subcontractor']) used.add('scope.' + v)

const i18n = await readFile(join(SRC, '30_i18n.js'), 'utf8')
function keysOf(varname, nextName) {
  const start = i18n.indexOf('var ' + varname)
  const end = nextName ? i18n.indexOf('var ' + nextName, start) : i18n.length
  const block = i18n.slice(start, end === -1 ? i18n.length : end)
  const out = new Set()
  for (const m of block.matchAll(/'([A-Za-z0-9_.]+)':/g)) out.add(m[1])
  return out
}

const EN = keysOf('EN', 'ZH')
const ZH = keysOf('ZH', 'T_NOW')

const missingEn = [...used].filter((k) => !EN.has(k)).sort()
const missingZh = [...used].filter((k) => !ZH.has(k)).sort()
const unusedEn = [...EN].filter((k) => !used.has(k) && !k.startsWith('meta.')).sort()

console.log(`keys used ${used.size} · EN ${EN.size} · ZH ${ZH.size}`)
console.log(`missing in EN (${missingEn.length}): ${missingEn.length ? missingEn.join(', ') : '(none)'}`)
console.log(`missing in ZH (${missingZh.length}): ${missingZh.length ? missingZh.join(', ') : '(none)'}`)
console.log(`defined but unused (${unusedEn.length}): ${unusedEn.length ? unusedEn.join(', ') : '(none)'}`)
if (missingEn.length || missingZh.length) process.exitCode = 1
