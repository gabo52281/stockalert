import { Loader2 } from 'lucide-react';

export default function Loading({ label = 'Cargando…' }) {
  return (
    <div className="loading-state">
      <Loader2 className="spin" size={26} />
      <span>{label}</span>
    </div>
  );
}
