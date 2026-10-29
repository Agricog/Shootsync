/**
 * Which source files actually ship: everything reachable by import from the app's entry
 * points. Source tests check these, so a rule is about code that runs, and a file nothing
 * imports can be found and deleted rather than quietly kept.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const repoRoot = fileURLToPath(new URL('..', import.meta.url))

/** The browser app, the prerendered pages and the server. */
export const ENTRY_POINTS = ['src/main.tsx', 'src/entry-prerender.tsx', 'server/index.ts'] as const

/** Relative imports of one file, resolved to repo paths ("./x.js" -> "x.ts"). */
function importsOf(file: string): string[] {
  const text = readFileSync(join(repoRoot, file), 'utf8')
  const info = ts.preProcessFile(text, true, true)
  const out: string[] = []
  for (const { fileName } of info.importedFiles) {
    if (!fileName.startsWith('.')) continue
    const base = normalize(join(dirname(file), fileName)).replace(/\.js$/, '')
    const found = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
      (candidate) => /\.(ts|tsx)$/.test(candidate) && existsSync(join(repoRoot, candidate))
    )
    if (found) out.push(found)
  }
  return out
}

/** Every file reachable by import from the entry points. */
export function reachableFiles(entries: readonly string[] = ENTRY_POINTS): Set<string> {
  const seen = new Set<string>()
  const stack = [...entries]
  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    stack.push(...importsOf(file))
  }
  return seen
}
