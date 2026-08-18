import { useEffect, useId, useRef } from 'react'
import Icon from './Icon'

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
        {title && (
          <div className="modal-head">
            <h2 id={titleId} className="section-title" style={{ marginBottom: 0 }}>
              {titleIcon ? <Icon name={titleIcon} size={18} /> : null}
              {title}
            </h2>
            <button type="button" className="btn btn-ghost icon-btn btn-sm" onClick={() => onClose?.()} aria-label="Fechar">
              <Icon name="x" />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
