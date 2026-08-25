import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export default function OverflowMenu({ items = [], label = 'Mais ações' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const visibleItems = items.filter(Boolean)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  if (!visibleItems.length) return null

  return (
    <div className="overflow-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="moreVertical" size={18} />
      </button>
      {open && (
        <div className="overflow-menu-panel card" role="menu">
          {visibleItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`dropdown-item${item.danger ? ' is-danger' : ''}`}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onClick?.()
              }}
            >
              {item.icon ? <Icon name={item.icon} size={16} spin={item.spin} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
