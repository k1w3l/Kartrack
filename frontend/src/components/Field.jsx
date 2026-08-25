import { useState } from 'react'
import Icon from './Icon'

export default function Field({ label, icon, htmlFor, children, span = false }) {
  return (
    <div className={`field${span ? ' span-2' : ''}`}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {icon ? <Icon name={icon} size={14} /> : null}
          {label}
        </label>
      ) : null}
      {children}
    </div>
  )
}

export function LookupSelect({
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  placeholder = 'Selecione',
  addPlaceholder,
  addAriaLabel = 'Cadastrar novo',
  onAdd,
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const next = String(draft || '').trim()
    if (!next || busy) return
    setBusy(true)
    try {
      const result = await onAdd?.(next)
      if (result === false) return
      setDraft('')
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="input-row">
        <select
          className="select"
          value={value}
          required={required}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {onAdd ? (
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            aria-label={adding ? 'Cancelar cadastro' : addAriaLabel}
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
          >
            <Icon name={adding ? 'x' : 'plus'} />
          </button>
        ) : null}
      </div>
      {adding && onAdd ? (
        <div className="inline-add">
          <input
            className="input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={addPlaceholder}
          />
          <button type="button" className="btn btn-accent btn-sm" disabled={busy || !String(draft).trim()} onClick={submit}>
            Adicionar
          </button>
        </div>
      ) : null}
    </>
  )
}

export function ChipList({ items, onRemove }) {
  return (
    <div className="cluster" style={{ marginTop: 8 }}>
      {items.map((item, idx) => (
        <span className="chip" key={`${item.nome}-${idx}`}>
          {item.nome} • R$ {Number(item.valor).toFixed(2)}
          <button type="button" className="chip-btn" onClick={() => onRemove(idx)} title="Remover" aria-label="Remover">
            <Icon name="x" size={14} />
          </button>
        </span>
      ))}
    </div>
  )
}

export function AutoGrowTextarea({ value, onChange, minRows = 2, id }) {
  return (
    <textarea
      id={id}
      className="textarea"
      rows={minRows}
      value={value}
      onInput={(e) => {
        e.currentTarget.style.height = 'auto'
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
      }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
