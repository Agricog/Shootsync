/**
 * Facts the syndicate and game book guides state, pinned to their sources as opened on
 * 13 October 2026 (Standard §05.7), and the guides held to typing none of them.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHOOTING_LAW } from '../src/data/shootingLaw.js'
import { londonDate } from '../src/utils/beaterPayCalculator.js'
import { stripComments } from './sourceText.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GUIDES = ['src/pages/public/guides/ShootingGameBook.tsx']

describe('shooting law facts', () => {
  it('match their sources', () => {
    assert.equal(SHOOTING_LAW.shotgunCertificate.usualYears, 5)
    assert.equal(SHOOTING_LAW.shotgunCertificate.issuedBy, 'the police')
    assert.equal(SHOOTING_LAW.gameLicence.abolishedOn, '2007-08-01')
    assert.equal(SHOOTING_LAW.gameLicence.extent, 'England and Wales')
    assert.equal(SHOOTING_LAW.code.steeringBodies, 10)
  })

  it('every source is https, and the law is cited from GOV.UK or legislation.gov.uk', () => {
    for (const source of Object.values(SHOOTING_LAW.sources)) assert.match(source.url, /^https:\/\//)
    assert.match(SHOOTING_LAW.sources.certificates.url, /^https:\/\/www\.gov\.uk\//)
    assert.match(SHOOTING_LAW.sources.gameOrder.url, /^https:\/\/www\.legislation\.gov\.uk\//)
  })

  it('is not past its review date (when this fails: re-open the sources, update shootingLaw.ts)', () => {
    const today = londonDate(new Date())
    assert.ok(SHOOTING_LAW.lastVerified <= today, 'verified in the future')
    assert.ok(today < SHOOTING_LAW.reviewBy, `shooting law facts due for review on ${SHOOTING_LAW.reviewBy}`)
  })
})

describe('the syndicate and game book guides type none of these facts', () => {
  for (const file of GUIDES) {
    it(file, () => {
      const page = stripComments(readFileSync(path.join(root, file), 'utf8'), file)
      assert.ok(page.includes('SHOOTING_LAW'), 'the guide does not read the rules file')
      assert.doesNotMatch(page, /\b(five|5)[- ]years?\b/i, 'certificate length typed')
      assert.doesNotMatch(page, /\b20\d\d\b/, 'a year typed')
      assert.doesNotMatch(page, /£\s?\d/, 'a pound figure typed')
    })
  }
})
