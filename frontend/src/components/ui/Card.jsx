export function Card({ children, className = '', ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <header className="card__header">
      <div>
        <h2 className="card__title">{title}</h2>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`card__body ${className}`}>{children}</div>;
}
