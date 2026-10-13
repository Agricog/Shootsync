/**
 * CSV helpers for exports the captain opens in a spreadsheet or uploads to a bank.
 */

/** One cell: always quoted, quotes doubled, and never read as a formula (CSV injection). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

/** Rows to CSV text with Windows line endings, which every spreadsheet and bank accepts. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
