/**
 * Input Component - ShootSync
 * Accessible input with validation display
 */

import { forwardRef, useId } from 'react'

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'time'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType
  label: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className = '',
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const errorId = `${id}-error`
    const hintId = `${id}-hint`

    const describedBy = [
      error ? errorId : null,
      hint ? hintId : null,
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="space-y-1">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          )}
        </label>

        {hint && (
          <p id={hintId} className="text-sm text-slate-500">
            {hint}
          </p>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={`
              w-full px-3 py-2 
              bg-slate-800 border rounded-lg
              text-white placeholder-slate-500
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-slate-700 focus:ring-green-500 focus:border-green-500'
              }
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="text-sm text-red-500 flex items-center gap-1"
            role="alert"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
