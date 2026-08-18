import Icon from './Icon'

export function Spinner({ label = 'Carregando...', className = '' }) {
  return (
    <div className={`app-loading ${className}`} role="status" aria-live="polite">
      <div className="app-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function TimelineSkeleton({ rows = 4 }) {
  return (
    <div className="timeline-log" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="timeline-item" key={i} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="timeline-rail" />
          <div>
            <div className="cluster">
              <span className="skeleton skeleton-circle" />
              <span className="skeleton skeleton-line" style={{ width: '38%' }} />
              <span className="skeleton skeleton-line" style={{ width: '90px', marginLeft: 'auto' }} />
            </div>
            <span className="skeleton skeleton-line" style={{ width: '64%', marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ButtonSpinner() {
  return <span className="btn-spinner" aria-hidden="true" />
}

export function EmptyIcon({ name = 'chart' }) {
  return <Icon name={name} size={28} />
}
