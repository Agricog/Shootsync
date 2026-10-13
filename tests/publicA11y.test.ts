/**
 * Public pages: two accessibility faults that axe found site-wide on 13 October 2026, kept out.
 * (Standard §17.4, §17.5.) Tailwind does not read tests/, so naming classes here adds nothing
 * to the stylesheet (§18.12).
 *
 * 1. Every public page sits on slate-900 or slate-950. Text in slate-500 or darker fails WCAG AA
 *    there (3.75:1 on slate-900), so it is never used for text on a public page.
 * 2. A table wrapper that scrolls sideways must be reachable and named for keyboard users:
 *    tabIndex={0}, role="region" and an aria-label.
 *
 * This is a backstop. The proof is axe on every built page (§17.4): 0 violations across 13 pages
 * at 390 and 1280 pixels on 13 October 2026, run by hand because CI has no browser yet (§18.9).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function files(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`
    return statSync(path.join(root, rel)).isDirectory() ? files(rel) : /\.tsx$/.test(name) ? [rel] : []
  })
}

export const LOW_CONTRAST_TEXT = /\btext-(slate|gray)-(500|600|700|800)\b/
export const SCROLL_WRAPPER = /<div className="[^"]*\boverflow-x-auto\b[^"]*"([^>]*)>/g

export function unlabelledScrollWrappers(source: string): string[] {
  return [...source.matchAll(SCROLL_WRAPPER)]
    .filter((m) => !(/tabIndex=\{0\}/.test(m[1]) && /role="region"/.test(m[1]) && /aria-label="[^"]{10,}"/.test(m[1])))
    .map((m) => m[0])
}

const publicFiles = [...files('src/pages/public'), ...files('src/components/public')]

describe('public pages: accessibility guards', () => {
  it('reads every public page and component', () => {
    assert.ok(publicFiles.length >= 15, String(publicFiles.length))
    assert.ok(publicFiles.includes('src/components/public/PublicLayout.tsx'))
    assert.ok(publicFiles.includes('src/pages/public/tools/BeaterPayCalculator.tsx'))
  })

  it('no text in slate-500 or darker on the dark public pages', () => {
    const found = publicFiles.filter((file) => LOW_CONTRAST_TEXT.test(readFileSync(path.join(root, file), 'utf8')))
    assert.deepEqual(found, [])
  })

  it('every sideways-scrolling table can be reached and is named', () => {
    const found = publicFiles.flatMap((file) => unlabelledScrollWrappers(readFileSync(path.join(root, file), 'utf8')).map((w) => `${file}: ${w}`))
    assert.deepEqual(found, [])
  })
})

describe('the guards themselves', () => {
  it('catch the faults axe found, and pass the fixes', () => {
    assert.ok(LOW_CONTRAST_TEXT.test('className="text-sm text-slate-500 mb-6"'))
    assert.ok(!LOW_CONTRAST_TEXT.test('className="text-sm text-slate-400 mb-6"'))
    assert.ok(!LOW_CONTRAST_TEXT.test('className="bg-slate-500"'))
    assert.equal(unlabelledScrollWrappers('<div className="overflow-x-auto">').length, 1)
    assert.equal(unlabelledScrollWrappers('<div className="overflow-x-auto" tabIndex={0}>').length, 1)
    assert.equal(unlabelledScrollWrappers('<div className="overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label="Rates table, scrolls sideways">').length, 0)
  })
})
