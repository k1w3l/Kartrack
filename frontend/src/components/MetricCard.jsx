import Icon from './Icon'

export default function MetricCard({ icon, title, value, hint }) {
  return (
    <div className="metric-card" role="listitem">
      <div className="label"><Icon name={icon} size={14} />{title}</div>
      <div className="value">{value}</div>
      {hint ? <p className="muted small metric-hint">{hint}</p> : null}
    </div>
  )
}
