/**
 * Input Sanitization - ShootSync
 * XSS protection utilities
 */

export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export const sanitizeForDisplay = (input: string | undefined | null): string => {
  if (!input) return ''
  return sanitizeHtml(input.trim())
}

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100)
}

export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[^\w\s@.-]/g, '')
    .substring(0, 100)
}

export const stripHtmlTags = (input: string): string => {
  return input.replace(/<[^>]*>/g, '')
}

export const sanitizePhoneNumber = (phone: string): string => {
  return phone.replace(/[^\d+]/g, '')
}

export const sanitizePostcode = (postcode: string): string => {
  return postcode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^(.+?)(\d[A-Z]{2})$/, '$1 $2')
}

export const escapeForJson = (input: string): string => {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}
