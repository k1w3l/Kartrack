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

export function ToggleCreate({ show, onToggle, addLabel, cancelLabel, value, onChange, onAdd, placeholder }) {
  return (
    <>
      <button type="button" className="btn btn-link btn-sm" onClick={onToggle}>{show ? cancelLabel : addLabel}</button>
      {show && (
        <div className="inline-add">
          <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          <button type="button" className="btn btn-accent btn-sm" onClick={onAdd}>Adicionar</button>
        </div>
      )}
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
