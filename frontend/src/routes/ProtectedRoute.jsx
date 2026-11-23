import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { homePathFor, useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="full-loader">
        <Loader2 className="spin" size={32} />
        <span>Cargando STOCKALERT…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (permission && !hasPermission(permission)) {
    // El superadministrador no tiene permisos de inventario por diseño: una
    // URL directa o un estado de login antiguo no debe dejarlo en una pantalla
    // de error, sino devolverlo a su panel.
    if (user.role === 'SUPERADMINISTRADOR') {
      const home = homePathFor(user);
      if (home !== location.pathname) return <Navigate to={home} replace />;
    }
    return <Navigate to="/acceso-denegado" replace />;
  }

  return children;
}
