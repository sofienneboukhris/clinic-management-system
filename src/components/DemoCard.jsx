// ============================================================================
// مكوّن البطاقة التجريبية (DemoCard)
// مكوّن بسيط قابل لإعادة الاستخدام لعرض البطاقات التجريبية في الواجهة التأسيسية
// ============================================================================

export function StatCard({ card, isHighlighted }) {
  return (
    <div className={`stat-card ${isHighlighted ? 'card-highlighted' : ''}`}>
      <div className="stat-card-header">
        <span className="stat-title">{card.title}</span>
        <span className="stat-badge">{card.badge}</span>
      </div>
      <div className="stat-value">{card.value}</div>
      <p className="stat-note">{card.note}</p>
    </div>
  )
}

export function SectionDemoCard({ card, isHighlighted }) {
  return (
    <article className={`demo-card ${isHighlighted ? 'card-highlighted' : ''}`}>
      <div className="demo-card-header">
        <h3 className="demo-card-title">{card.title}</h3>
        <span className="role-tag">{card.userRole}</span>
      </div>

      <ul className="demo-items-list">
        {card.items.map((item, index) => (
          <li key={index} className="demo-item">
            {item}
          </li>
        ))}
      </ul>

      <div className="demo-card-footer">
        <strong>ملاحظة التطوير المستقبلي: </strong>
        <span>{card.futureNote}</span>
      </div>
    </article>
  )
}
