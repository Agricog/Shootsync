# ShootSync batch 6a of 6a–6h: Public pages: readable grey text, a footer link you can see, a header that fits a 320px phone

**Land after:** nothing: this is first. Live main must be green (it was, run #23).
**Predicted CI:** green, **397 tests** (rehearsed in order on a copy of live main plus every earlier batch).
**No dot-files, no hand edits, no console steps.**

## Why

axe (WCAG 2.2 AA), run on every built public page at 390 and 1280 pixels, found 155 failing nodes before this work: grey slate-500 text at 3.75:1 (needs 4.5:1) in breadcrumbs, review dates and the footer line on every page; the footer email link told apart only by colour; the home page's feature-card links at 4.43:1. At 320px the header's Get started button ran 11px off the screen. Pure class changes: no words, no behaviour.

## Files (6)

Open the `batch-6a` folder, select everything at its top level, drag onto the repo's upload page at the root. Before committing, check every path in the upload list starts with the folder below.

| Path | Lines | |
|---|---|---|
| `src/components/public/GuidePage.tsx` | 157 | replace |
| `src/components/public/LegalPage.tsx` | 62 | replace |
| `src/components/public/PublicLayout.tsx` | 157 | replace |
| `src/pages/public/Features.tsx` | 226 | replace |
| `src/pages/public/Landing.tsx` | 380 | replace |
| `src/pages/public/Pricing.tsx` | 146 | replace |

## Commit message

```
Batch 6a: Public pages: readable grey text, a footer link you can see, a header that fits a 320px phone

Raise grey text from slate-500 to slate-400 on every public page (WCAG AA contrast).
Underline the footer email link so it is not told apart by colour alone.
Home feature-card links to green-400 (4.43:1 was under 4.5:1).
Header gaps and wordmark size tightened below the sm breakpoint so the
header fits a 320px phone with no sideways scroll (Standard 18.10).

axe 155 failing nodes before, 0 after this and 6b, across 13 pages at 390 and
1280px, checked by hand in headless Chromium (CI has no browser yet, 18.9).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019bdtzik3P1Z2iVPwLSh9C2
```
