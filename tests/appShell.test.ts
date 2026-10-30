/**
 * The signed-in app's wiring, read from the source with the TypeScript parser (CI has no
 * browser to click through it yet), so formatting can neither hide a break nor fake one.
 *
 * - Every captain page sits behind <CaptainRoute>, so it always has a syndicate and a captain.
 * - No page fetches its own list of syndicates and takes the first: one source, GET /api/me.
 * - No page talks to the API except through src/lib/api.ts, so every failure reads as a sentence.
 * - A route is a promise: nothing is routed that has no API behind it.
 * - Everything the app keeps in localStorage is on the sign-out wipe list (Standard §03 Layer 4).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { stripComments } from './sourceText.js'
import { reachableFiles, repoRoot as root } from './sourceGraph.js'
import { LOCAL_STORAGE_KEYS } from '../src/lib/storageKeys.js'
import { APP_PATHS, isAppPath } from '../server/app.js'
import { PUBLIC_ROUTES } from '../src/config/site.js'

const read = (path: string) => readFileSync(join(root, path), 'utf8')
const parse = (path: string) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

const tagName = (node: ts.Node): string | null =>
  ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? node.tagName.getText() : null

/** The browser code that actually ships: reachable from src/main.tsx. */
const shipped = [...reachableFiles(['src/main.tsx'])].filter((f) => f.startsWith('src/'))

const app = parse('src/App.tsx')

interface RouteEntry {
  path: string
  /** Every element in the route's element prop, outermost first. */
  chain: string[]
}

/** Each <Route>: its path, and the elements its element prop nests, outermost first. */
function routes(): RouteEntry[] {
  const found: RouteEntry[] = []
  walk(app, (node) => {
    if (tagName(node) !== 'Route') return
    const attributes = (node as ts.JsxSelfClosingElement | ts.JsxOpeningElement).attributes.properties
    let path = ''
    const chain: string[] = []
    for (const prop of attributes) {
      if (!ts.isJsxAttribute(prop) || !prop.initializer) continue
      const name = prop.name.getText()
      if (name === 'path' && ts.isStringLiteral(prop.initializer)) path = prop.initializer.text
      if (name === 'element') {
        walk(prop.initializer, (inner) => {
          const tag = tagName(inner)
          if (tag) chain.push(tag)
        })
      }
    }
    found.push({ path, chain })
  })
  return found
}

/** Component name -> the file it is imported from. */
function imports(): Map<string, string> {
  const map = new Map<string, string>()
  for (const statement of app.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const name = statement.importClause?.name?.getText()
    if (name) map.set(name, statement.moduleSpecifier.text)
  }
  return map
}

describe('the signed-in app', () => {
  it('reads the route table (guards the parser itself)', () => {
    const table = routes()
    assert.ok(table.length >= 30, `only ${table.length} routes`)
    assert.deepEqual(table.find((r) => r.path === '/members')?.chain, ['ProtectedRoute', 'CaptainRoute', 'Members'])
  })

  it('every captain page is behind CaptainRoute, inside ProtectedRoute', () => {
    const from = imports()
    const unguarded: string[] = []
    let captainPages = 0
    for (const { path, chain } of routes()) {
      const page = chain.find((tag) => from.get(tag)?.startsWith('./pages/captain/'))
      if (!page) continue
      captainPages++
      const before = chain.slice(0, chain.indexOf(page))
      // Setting up a first syndicate is the one captain page that needs no syndicate yet.
      const needed = page === 'CreateSyndicate' ? ['ProtectedRoute'] : ['ProtectedRoute', 'CaptainRoute']
      if (JSON.stringify(before) !== JSON.stringify(needed)) unguarded.push(`${path}: ${chain.join(' > ')}`)
    }
    assert.ok(captainPages >= 12, `only ${captainPages} captain pages found`)
    assert.deepEqual(unguarded, [])
  })

  it('routes nothing to the old demo portals', () => {
    for (const [name, file] of imports()) {
      assert.doesNotMatch(file, /^\.\/pages\/(gun|beater)\//, `${name} is imported from ${file}`)
    }
  })

  it('the server knows every app route, so only a page nobody has gets a 404', () => {
    // Public pages are served prerendered, so they are not the app's to answer for.
    const publicPaths = new Set<string>(PUBLIC_ROUTES.map((r) => r.path))
    const table = routes().map((r) => r.path).filter((p) => p !== '*' && !publicPaths.has(p))
    assert.ok(table.length >= 15, `only ${table.length} routes read`)
    // Each route, with any parameter or splat filled in the way a real address would have it.
    const example = (p: string) => p.replace(/:[A-Za-z]+/g, 'abc123').replace(/\/\*$/, '/factor-one')
    for (const p of table) {
      assert.ok(isAppPath(example(p)), `${p} (${example(p)}) is not in APP_PATHS`)
      if (p.endsWith('/*')) assert.ok(isAppPath(p.slice(0, -2)), `${p} without its splat`)
    }
    // And nothing more: every pattern answers for a route in the table (or a public page, which the server serves prerendered).
    const everything = [...table.map(example), ...table.filter((p) => p.endsWith('/*')).map((p) => p.slice(0, -2))]
    for (const pattern of APP_PATHS) assert.ok(everything.some((p) => pattern.test(p)), `${pattern} matches no route`)
    for (const stray of ['/dashboard/', '/dashboard/anything', '/shoots/a/b', '/members/abc', '/nope', '/guides/nope', '/pegs/1']) assert.equal(isAppPath(stray), false, stray)
  })

  it('every routed page exists', () => {
    for (const file of imports().values()) {
      if (!file.startsWith('./pages/')) continue
      assert.ok(existsSync(join(root, 'src', `${file.slice(2)}.tsx`)), `${file} does not exist`)
    }
  })

  const appFiles = shipped.filter((f) => /^src\/(pages\/captain|components|context|hooks)\//.test(f))

  it('reads the shipped files (guards the import graph itself)', () => {
    assert.ok(appFiles.includes('src/pages/captain/Dashboard.tsx'))
    assert.ok(appFiles.includes('src/context/SyndicateContext.tsx'))
    assert.ok(appFiles.length >= 30, `only ${appFiles.length} files`)
  })

  it('no page picks its own syndicate: the one on show comes from GET /api/me', () => {
    const offenders = appFiles.filter((file) => {
      const code = stripComments(read(file))
      return /syndicates\s*\[\s*0\s*\]|['"`]\/api\/syndicates['"`]\s*[,)]/.test(code)
    })
    // CreateSyndicate posts to /api/syndicates; that is creating one, not choosing one.
    assert.deepEqual(offenders.filter((f) => !f.endsWith('CreateSyndicate.tsx')), [])
  })

  it('every API call goes through src/lib/api.ts', () => {
    const offenders: string[] = []
    for (const file of appFiles) {
      walk(parse(file), (node) => {
        if (!ts.isCallExpression(node)) return
        const callee = node.expression.getText()
        if (callee === 'fetch' || /\.fetch$/.test(callee)) offenders.push(`${file}: ${callee}(`)
      })
    }
    assert.deepEqual(offenders, [])
  })
})

describe('a syndicate without a paid-up plan', () => {
  const layout = read('src/components/layout/DashboardLayout.tsx')

  it('every signed-in page shows the read-only notice (it lives in the shared layout)', () => {
    assert.match(layout, /<Navigation \/>\s*<ReadOnlyNotice \/>/)
  })

  /** Screens that change data, and why any is allowed to without checking the plan itself. */
  const EXEMPT: Record<string, string> = {
    'src/pages/captain/CreateSyndicate.tsx': 'a new syndicate is created before it has a plan',
    'src/pages/captain/Subscribe.tsx': 'choosing a plan is how a lapsed syndicate is opened up again',
    'src/components/shoots/ShootDayEditor.tsx': 'only rendered by ShootDetail when canWrite is true',
  }

  /**
   * Places the file reads canWrite or readOnly, leaving out where they are declared, so a
   * value fetched and never looked at gates nothing (and a mention in a string or comment
   * is not code at all).
   */
  function gateUses(source: ts.SourceFile): number {
    let uses = 0
    walk(source, (node) => {
      if (!ts.isIdentifier(node) || !['canWrite', 'readOnly'].includes(node.text)) return
      const parent = node.parent
      const declaring =
        ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.propertyName === node) ||
        ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyAccessExpression(parent)) && parent.name === node)
      if (!declaring) uses++
    })
    return uses
  }
  const probe = (code: string) => gateUses(ts.createSourceFile('probe.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))

  it('the gate check counts reads, not declarations, strings or comments', () => {
    assert.equal(probe('const canWrite = useCanWrite()'), 0)
    assert.equal(probe("const canWrite = useCanWrite(); const s = 'canWrite' // canWrite"), 0)
    assert.equal(probe('function F({ canWrite }: { canWrite: boolean }) { return null }'), 0)
    assert.equal(probe('const canWrite = useCanWrite(); const x = canWrite && 1'), 1)
    assert.equal(probe('const canWrite = useCanWrite(); const el = <Button disabled={!canWrite} />'), 1)
  })

  it('every screen that changes data offers it only while the plan is paid up', () => {
    const offenders: string[] = []
    for (const file of shipped) {
      if (!/^src\/(pages\/captain|components)\//.test(file) || EXEMPT[file]) continue
      const code = stripComments(read(file))
      const writes = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]|send\([^)]*['"](POST|PATCH|PUT|DELETE)['"]|run\([^)]*['"](POST|PATCH|PUT|DELETE)['"]/.test(code)
      if (writes && gateUses(parse(file)) === 0) offenders.push(file)
    }
    assert.deepEqual(offenders, [])
  })

  it('the exemptions are real files that still write', () => {
    for (const file of Object.keys(EXEMPT)) assert.ok(shipped.includes(file), `${file} is not shipped`)
  })

  it('ShootDayEditor is only shown when the plan is paid up', () => {
    assert.match(read('src/pages/captain/ShootDetail.tsx'), /!editingDay && canWrite &&/)
  })
})

describe('what this browser keeps (Standard §03 Layer 4)', () => {
  /** String constants declared anywhere in the shipped code, by name. */
  function constants(): Map<string, string> {
    const map = new Map<string, string>()
    for (const file of shipped) {
      walk(parse(file), (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isStringLiteralLike(node.initializer)) {
          map.set(node.name.text, node.initializer.text)
        }
      })
    }
    return map
  }

  it('the wipe list is not empty (guards the import)', () => {
    assert.ok(LOCAL_STORAGE_KEYS.length >= 2)
  })

  it('every localStorage key the app writes is wiped on sign-out', () => {
    const named = constants()
    const problems: string[] = []
    let writes = 0
    for (const file of shipped) {
      walk(parse(file), (node) => {
        if (!ts.isCallExpression(node) || !/localStorage\.setItem$/.test(node.expression.getText())) return
        writes++
        const [keyArg] = node.arguments
        const key = keyArg && ts.isStringLiteralLike(keyArg) ? keyArg.text : keyArg && ts.isIdentifier(keyArg) ? named.get(keyArg.text) : undefined
        if (key === undefined) problems.push(`${file}: can't tell which key ${keyArg?.getText()} is`)
        else if (!(LOCAL_STORAGE_KEYS as readonly string[]).includes(key)) problems.push(`${file}: "${key}" is not wiped at sign-out`)
      })
    }
    assert.ok(writes >= 1, 'found no localStorage writes at all: the reader is broken')
    assert.deepEqual(problems, [])
  })

  it('the app writes no other browser storage it would have to wipe', () => {
    for (const file of shipped) {
      const code = stripComments(read(file))
      assert.doesNotMatch(code, /sessionStorage\s*\.\s*setItem|indexedDB\s*\.\s*open/, `${file} writes storage the sign-out wipe doesn't know about`)
    }
  })
})
