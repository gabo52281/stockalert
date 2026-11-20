const LEVELS = {
  NORMAL: { label: 'Normal', className: 'status--normal' },
  BAJO: { label: 'Stock bajo', className: 'status--low' },
  CRITICO: { label: 'Crítico', className: 'status--critical' },
  AGOTADO: { label: 'Agotado', className: 'status--out' },
};

const STATES = {
  active: { label: 'Activo', className: 'status--normal' },
  inactive: { label: 'Inactivo', className: 'status--muted' },
  IN: { label: 'Entrada', className: 'status--normal' },
  OUT: { label: 'Salida', className: 'status--info' },
  CALCULABLE: { label: 'Calculable', className: 'status--normal' },
  INSUFICIENTE: { label: 'Sin datos suficientes', className: 'status--low' },
  NO_CALCULABLE: { label: 'No calculable', className: 'status--muted' },
};

export default function StatusPill({ value }) {
  const config = LEVELS[value] || STATES[value] || { label: value || '—', className: 'status--muted' };
  return <span className={`status-pill ${config.className}`}>{config.label}</span>;
}
