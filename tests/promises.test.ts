/**
 * Every word on a page is true (the owner's mantra: a premium product makes no claim it can't
 * keep). ShootSync sends no email, notifies nobody, and keeps nothing for later while offline.
 * Until it does, no shipped text may say otherwise. This reads every string and every piece of
 * page text in the browser code and the static pages, so a false promise fails the build.
 *
 * When a feature is built for real, remove its words from FORBIDDEN here and nowhere else.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { repoRoot as root } from './sourceGraph.js'

/** Claims the product can't keep today, as a user would read them. */
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\b(has|have|will|’ll|'ll) been notified\b|\bteam (has|have) been notified\b|\bwe(’|')?ve notified\b/i, why: 'nobody is notified' },
  // The app itself sends nothing. (The Terms' "we will email you 30 days before a price change" is
  // the operator's promise, kept by hand from his own mailbox, so it is allowed.)
  { pattern: /\bconfirmation (email|e-mail)\b|\b(email|confirmation|receipt|details) (has|have) been sent\b|\b(you|they)(’|')?(ll| will) receive (an? )?(email|confirmation|reminder|shoot details)\b|\bShootSync (will |’ll |'ll )?(send|email)s? (you|them|the guest|a )/i, why: 'ShootSync sends no email' },
  { pattern: /\bsyncs?\b.*\b(automatically|when (you(’|')?re|back) online)\b|\bwill sync\b/i, why: 'nothing is kept for later while offline' },
  { pattern: /\b(works|available|still works?) offline\b|\boffline (bag|recording|mode)\b/i, why: 'the app does not work offline' },
  { pattern: /\bpay(s|ing)? (the|their|any) (day )?fee\b(?! (to|directly))|\bcard payment\b.*\bguest\b|\bpay online\b/i, why: 'guest card payments are switched off' },
  { pattern: /\b(reminder|notification)s? (will be|are|is) sent\b|\bpush notification/i, why: 'no reminders or notifications are sent' },
]

/** Text a user could read: string literals, template text and JSX text. Comments and code are skipped. */
function readableText(file: string): string[] {
  const code = readFileSync(join(root, file), 'utf8')
  if (file.endsWith('.html')) return [code.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')]
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const walk = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text)
    else if (ts.isTemplateExpression(node)) out.push([node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' … '))
    else if (ts.isJsxText(node)) out.push(node.text)
    ts.forEachChild(node, walk)
  }
  walk(source)
  return out
}

function files(dir: string, keep: (f: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry)
    if (statSync(join(root, path)).isDirectory()) out.push(...files(path, keep))
    else if (keep(path)) out.push(relative('', path))
  }
  return out
}

describe('every word on a page is true', () => {
  const shipped = [
    ...files('src', (f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)),
    ...files('public', (f) => f.endsWith('.html')),
  ]

  it('reads real text, not nothing', () => {
    const total = shipped.reduce((n, f) => n + readableText(f).length, 0)
    assert.ok(total > 500, `only ${total} strings read`)
  })

  it('the checks catch the sentences that were on the live site before 29 Oct 2026', () => {
    const caught = (text: string) => FORBIDDEN.some((f) => f.pattern.test(text))
    assert.ok(caught('We have encountered an unexpected error. Our team has been notified.'))
    assert.ok(caught('If you completed payment, you should receive a confirmation email shortly.'))
    assert.ok(caught("Your data will sync automatically when you're back online."))
    assert.ok(caught('Some features still work offline:'))
    assert.ok(caught('On it they confirm, sign the waiver and pay any day fee.'))
    assert.ok(caught('A confirmation email has been sent to'))
    // Plain, true sentences pass.
    assert.equal(caught('Nothing is sent to them.'), false)
    assert.equal(caught('ShootSync doesn’t email guests: copy their invite link and send it yourself.'), false)
    assert.equal(caught('Give us a working email address. That’s where we send anything important.'), false)
  })

  it('no shipped text makes a claim the product can’t keep', () => {
    const offenders: string[] = []
    for (const file of shipped) {
      for (const text of readableText(file)) {
        for (const { pattern, why } of FORBIDDEN) {
          if (pattern.test(text)) offenders.push(`${file}: "${text.trim().slice(0, 90)}" (${why})`)
        }
      }
    }
    assert.deepEqual(offenders, [])
  })
})
