import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  readonly message: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

// FRONTEND-043-AC-01/02: a small, generic "are you sure" confirmation dialog,
// reused by AddSeriesForm/EditSeriesForm's discard-unsaved-changes prompt and
// (later) frontend_spec_045's Look Up overwrite warning. Rendered as
// role="alertdialog" (not plain role="dialog") -- the WAI-ARIA pattern for a
// dialog interrupting the user to confirm or abort an action, distinct from
// the two forms' own role="dialog" underneath it.
export function ConfirmDialog({
  message,
  confirmLabel = 'Discard',
  cancelLabel = 'Keep Editing',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Stop this Escape from also bubbling into the outer form dialog's own
      // onKeyDown handler, which would otherwise close the form entirely
      // (rather than just this confirmation) in the same keystroke.
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className={styles.overlay}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss mirrors the same established pattern as AddSeriesForm/EditSeriesForm's own dialog root. */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-dialog-message"
        onKeyDown={handleKeyDown}
      >
        <p id="confirm-dialog-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
