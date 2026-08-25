import { useEffect } from 'react'
import Icon from './Icon'

export default function FilterSheet({ open, onClose, title = 'Filtros', children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="filter-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title">
        <div className="modal-head">
          <h2 id="filter-sheet-title" className="section-title" style={{ marginBottom: 0 }}>
            <Icon name="filter" size={18} />{title}
          </h2>
          <button type="button" className="btn btn-ghost icon-btn" onClick={() => onClose?.()} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className="stack">{children}</div>
        <div className="modal-foot">
          {footer}
          <button type="button" className="btn btn-primary" onClick={() => onClose?.()}>Pronto</button>
        </div>
      </div>
    </div>
  )
}
