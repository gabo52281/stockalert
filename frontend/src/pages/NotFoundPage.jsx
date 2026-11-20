import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState.jsx';
import Button from '../components/ui/Button.jsx';

export default function NotFoundPage() {
  return (
    <div className="simple-page">
      <EmptyState icon={Compass} message="Página no encontrada" detail="La ruta solicitada no existe en STOCKALERT." />
      <Link to="/"><Button>Ir al panel principal</Button></Link>
    </div>
  );
}
