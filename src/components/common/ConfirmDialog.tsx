/**
 * A confirmation dialog of ShootSync's own, in place of the browser's confirm() pop-up.
 *
 * It is a real dialog: it is announced as one, it names the question and the consequence, focus
 * moves into it when it opens and goes back where it was when it closes, Tab stays inside it,
 * and Escape is "no". The confirming action is named for what it does ("Remove the guest"), never
 * "OK": there is no mistaking which button does the irreversible thing.
 */

import { useEffect, useRef } from 'react'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** What happens if they confirm, in a sentence or two. */
  children: React.ReactNode
  /** The confirming button's words: say what it does. */
  confirmLabel: string
  cancelLabel?: string
  /** 'danger' for anything that removes or can't be undone. */
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  // The latest handlers, so the effect below runs once per opening however often the parent renders.
  const cancel = useRef(onCancel)
  cancel.current = onCancel

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    // Focus starts on the safe choice, so Enter pressed out of habit changes nothing.
    cancelButton.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel.current()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      // Back where they were; if that control has gone (the record was removed), to the page's heading.
      if (opener?.isConnected) opener.focus?.()
      else (document.querySelector('main h1') as HTMLElement | null)?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-950/70" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="w-full max-w-md rounded-lg bg-slate-800 border border-slate-700 shadow-xl p-6"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">{title}</h2>
        <div id="confirm-dialog-body" className="mt-2 text-slate-300 space-y-2">{children}</div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button ref={cancelButton} type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone} onClick={onConfirm} isLoading={busy} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
