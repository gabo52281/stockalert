export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && !error && <small className="field__hint">{hint}</small>}
      {error && <small className="field__error">{error}</small>}
    </label>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Select({ children, ...props }) {
  return <select className="input select" {...props}>{children}</select>;
}

export function Textarea(props) {
  return <textarea className="input textarea" {...props} />;
}
