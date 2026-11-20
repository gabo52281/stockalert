import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState.jsx';
import Button from '../components/ui/Button.jsx';

export default function ForbiddenPage() {
  return (
    <div className="simple-page">
      <EmptyState
        icon={ShieldAlert}
        message="No tiene permisos para acceder a este módulo"
        detail="Su rol no autoriza esta operación. Contacte al administrador si lo considera necesario."
      />
      <Link to="/"><Button variant="primary">Volver al panel</Button></Link>
    </div>
  );
}
