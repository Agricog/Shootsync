/**
 * Reading source files in tests: code without its comments, character for character.
 * Shared by the guards that refuse figures typed into pages (typedFigures, seasonDates).
 */

import ts from 'typescript'

/**
 * Removes comments and nothing else. TypeScript's parser finds them: every comment is leading trivia
 * or trailing trivia of some token, so collecting those ranges finds them all, and a "/*" or "//"
 * inside a string or a JSX attribute (path="/login/*", 'Rates // ...') is never one. JSX text is
 * skipped, because "//" in text on a page is text. The original characters are kept exactly.
 */
export function stripComments(code: string, fileName = 'page.tsx'): string {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind)
  const ranges = new Map<number, number>()
  const jsxText: Array<[number, number]> = []
  const nodes: ts.Node[] = []
  const collect = (node: ts.Node) => {
    nodes.push(node)
    if (node.kind === ts.SyntaxKind.JsxText) jsxText.push([node.pos, node.end])
    for (const child of node.getChildren(source)) collect(child)
  }
  collect(source)
  const inText = (at: number) => jsxText.some(([start, end]) => at >= start && at < end)
  for (const node of nodes) {
    if (node.kind === ts.SyntaxKind.JsxText) continue
    // Leading: comments on the lines before a token. Trailing: comments after a token on its own line.
    const found = [...(ts.getLeadingCommentRanges(code, node.getFullStart()) ?? []), ...(ts.getTrailingCommentRanges(code, node.getEnd()) ?? [])]
    for (const range of found) if (!inText(range.pos)) ranges.set(range.pos, range.end)
  }
  let out = ''
  let at = 0
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (start < at) continue
    out += code.slice(at, start) + ' '
    at = end
  }
  return out + code.slice(at)
}
