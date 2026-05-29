// Componentes de carregamento reutilizáveis: spinner do sistema e skeletons
// animados (shimmer) para a timeline enquanto os dados são buscados.

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
    <div className="d-flex flex-column gap-3 mt-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="timeline-item skeleton-item" key={i} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="timeline-top-row">
            <div className="d-flex align-items-center gap-2 flex-grow-1">
              <span className="skeleton skeleton-circle" />
              <span className="skeleton skeleton-line" style={{ width: '38%' }} />
            </div>
            <span className="skeleton skeleton-line" style={{ width: '90px' }} />
          </div>
          <span className="skeleton skeleton-line mt-2" style={{ width: '64%' }} />
        </div>
      ))}
    </div>
  )
}
