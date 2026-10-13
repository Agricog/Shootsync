/**
 * Repository hardening (Standard §19.3, §01): the gate itself is pinned by tests,
 * so a tidy-up cannot quietly weaken it.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const read = (path: string) => readFileSync(root(path), 'utf8')

const workflowFiles = readdirSync(root('.github/workflows')).filter((f) => /\.ya?ml$/.test(f))
const pkg = JSON.parse(read('package.json'))

describe('workflows', () => {
  it('there is at least one workflow', () => {
    assert.ok(workflowFiles.length > 0)
  })

  for (const file of workflowFiles) {
    const text = read(`.github/workflows/${file}`)

    it(`${file}: every action is pinned to a full commit SHA`, () => {
      const uses = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1])
      assert.ok(uses.length > 0)
      for (const ref of uses) assert.match(ref, /@[0-9a-f]{40}$/, `${ref} is not SHA-pinned`)
    })

    it(`${file}: checkout never persists credentials`, () => {
      const checkouts = text.split(/uses:\s*actions\/checkout@/).length - 1
      const disabled = (text.match(/persist-credentials:\s*false/g) ?? []).length
      assert.equal(disabled, checkouts)
    })

    it(`${file}: workflow token is read-only at the top level`, () => {
      assert.match(text, /^permissions:\s*\n\s+contents:\s*read\s*$/m)
      assert.doesNotMatch(text, /^permissions:\s*write-all/m)
    })

    it(`${file}: no pull_request_target or workflow_run triggers`, () => {
      assert.doesNotMatch(text, /pull_request_target|workflow_run/)
    })

    it(`${file}: runs on a named runner image`, () => {
      assert.doesNotMatch(text, /runs-on:\s*ubuntu-latest/)
    })
  }

  it('the gate installs from the lockfile, audits, typechecks, tests and refuses a skipped run', () => {
    const ci = read('.github/workflows/ci.yml')
    for (const step of ['npm ci', 'npm audit --omit=dev --audit-level=high', 'npm run typecheck', 'npm test', 'check-test-report.mjs', 'npm run build']) {
      assert.ok(ci.includes(step), `ci.yml is missing "${step}"`)
    }
    assert.doesNotMatch(ci, /npm install\b/)
  })
})

describe('dependencies', () => {
  it('every version in package.json is exact', () => {
    for (const section of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(pkg[section] as Record<string, string>)) {
        assert.match(version, /^\d+\.\d+\.\d+$/, `${name}@${version} is not an exact pin`)
      }
    }
  })

  it('Clerk is above the security floor (GHSA-w24r-5266-9c3c affects <= 5.61.5)', () => {
    const [major, minor, patch] = pkg.dependencies['@clerk/clerk-react'].split('.').map(Number)
    assert.ok(major === 5 && (minor > 61 || (minor === 61 && patch >= 8)))
  })

  it('install scripts are approved per exact version, never by bare name', () => {
    for (const [entry, allowed] of Object.entries(pkg.allowScripts as Record<string, boolean>)) {
      if (allowed) assert.match(entry, /@\d+\.\d+\.\d+$/, `${entry} is approved without a version`)
    }
  })

  it('Node version is the same in .node-version and package.json engines', () => {
    assert.equal(read('.node-version').trim(), pkg.engines.node)
  })

  it('the build never pushes schema changes to the production database', () => {
    assert.doesNotMatch(pkg.scripts.build, /db push|accept-data-loss|migrate dev/)
  })

  it('React majors are held in dependabot.yml for the whole family, with a reason', () => {
    const dependabot = read('.github/dependabot.yml')
    for (const name of ['react', 'react-dom', '"@types/react"', '"@types/react-dom"']) {
      assert.match(dependabot, new RegExp(`dependency-name: ${name.replace(/[/@"-]/g, (c) => `\\${c}`)}\\n\\s+update-types: \\["version-update:semver-major"\\]`))
    }
    assert.match(dependabot, /Stack decision: React stays on 18/)
  })
})

describe('server', () => {
  it('no secret has a fallback value in server code', () => {
    const files = ['server/index.ts', 'server/app.ts', 'server/config.ts', ...readdirSync(root('server/routes')).map((f) => `server/routes/${f}`)]
    for (const file of files) {
      assert.doesNotMatch(read(file), /process\.env\.[A-Z_]*(SECRET|KEY)[A-Z_]*\s*(\|\||\?\?)/, `${file} has a fallback secret`)
    }
  })
})
