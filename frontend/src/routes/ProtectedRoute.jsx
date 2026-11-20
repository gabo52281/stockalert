import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

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
    return <Navigate to="/acceso-denegado" replace />;
  }

  return children;
}
