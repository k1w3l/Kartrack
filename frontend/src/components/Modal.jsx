import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, titleIcon, children, footer, width = 'min(560px, 92vw)', closeOnBackdrop = true, labelledBy }) {
  const cardRef = useRef(null)
  const previousFocus = useRef(null)
  const autoId = useId()
  const titleId = labelledBy || `modal-title-${autoId}`

  useEffect(() => {
    if (!open) return undefined

    previousFocus.current = document.activeElement

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = cardRef.current?.querySelectorAll(FOCUSABLE)
      if (!focusables || !focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey, true)
    const focusTimer = setTimeout(() => {
      const focusables = cardRef.current?.querySelectorAll(FOCUSABLE)
      ;(focusables?.[0] || cardRef.current)?.focus()
    }, 0)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey, true)
      clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={cardRef}
        tabIndex={-1}
        style={{ width }}
      >
        <div className="card-body">
          {title && (
            <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
              <h5 className="mb-0" id={titleId}>
                {titleIcon && <i className={`${titleIcon} me-2`} />}
                {title}
              </h5>
              <button type="button" className="btn btn-sm btn-outline-secondary icon-btn" onClick={() => onClose?.()} aria-label="Fechar">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}
          {children}
          {footer && <div className="d-flex justify-content-end gap-2 mt-3 flex-wrap">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
