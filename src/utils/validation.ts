/**
 * Input Validation - ShootSync
 * OWASP compliant input validation
 */

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  sanitized: string
}

export const validateInput = (
  input: string,
  type: 'email' | 'number' | 'text' | 'currency' | 'phone' | 'postcode',
  maxLength: number = 255
): ValidationResult => {
  const errors: Record<string, string> = {}
  let sanitized = input.trim()

  if (sanitized.length === 0) {
    return { isValid: true, errors: {}, sanitized: '' }
  }

  if (sanitized.length > maxLength) {
    errors.length = `Maximum ${maxLength} characters allowed`
  }

  switch (type) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(sanitized)) {
        errors.format = 'Invalid email format'
      }
      break
    }
    case 'number': {
      if (isNaN(Number(sanitized))) {
        errors.format = 'Must be a valid number'
      }
      break
    }
    case 'currency': {
      const currencyRegex = /^\d+(\.\d{1,2})?$/
      if (!currencyRegex.test(sanitized)) {
        errors.format = 'Invalid amount (e.g., 123.45)'
      }
      break
    }
    case 'phone': {
      const phoneRegex = /^[\d\s+()-]{10,20}$/
      if (!phoneRegex.test(sanitized)) {
        errors.format = 'Invalid phone number'
      }
      break
    }
    case 'postcode': {
      const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
      if (!postcodeRegex.test(sanitized)) {
        errors.format = 'Invalid UK postcode'
      }
      break
    }
  }

  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized
  }
}

export const validateRequired = (
  value: string | undefined | null,
  fieldName: string
): string | null => {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`
  }
  return null
}

export const validateDateRange = (
  startDate: string,
  endDate: string
): string | null => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date format'
  }
  
  if (start >= end) {
    return 'End date must be after start date'
  }
  
  return null
}

export const validatePositiveNumber = (
  value: number,
  fieldName: string
): string | null => {
  if (isNaN(value) || value < 0) {
    return `${fieldName} must be a positive number`
  }
  return null
}
