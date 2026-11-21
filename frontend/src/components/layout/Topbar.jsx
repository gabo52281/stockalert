import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const TITLES = [
  ['/superadmin', 'Administración general'],
  ['/', 'Panel principal'],
  ['/productos', 'Productos'],
  ['/movimientos', 'Movimientos de inventario'],
  ['/alertas', 'Alertas preventivas'],
  ['/indicadores', 'Indicadores y cobertura'],
  ['/ia', 'Asistente IA'],
  ['/categorias', 'Categorías'],
  ['/proveedores', 'Proveedores'],
  ['/reportes', 'Reportes'],
  ['/usuarios', 'Usuarios'],
  ['/perfil', 'Mi perfil'],
];

export default function Topbar({ onMenu, alertCount = 0 }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const title = TITLES.find(([path]) => path === pathname)?.[1] || 'STOCKALERT';

  const handleLogout = async () => {
    await logout();
    success('Sesión cerrada correctamente');
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="icon-button topbar__menu" onClick={onMenu} aria-label="Abrir menú">
          <Menu size={21} />
        </button>
        <div>
          <span className="topbar__eyebrow">STOCKALERT</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="topbar__right">
        <NavLink to="/alertas" className="topbar__bell" aria-label="Ver alertas">
          <Bell size={19} />
          {alertCount > 0 && <span className="topbar__bell-count">{alertCount > 99 ? '99+' : alertCount}</span>}
        </NavLink>

        <div className="user-menu">
          <button type="button" className="user-menu__trigger" onClick={() => setMenuOpen((value) => !value)}>
            <span className="avatar avatar--small">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="user-menu__name">{user?.name}</span>
          </button>
          {menuOpen && (
            <div className="user-menu__dropdown">
              <div className="user-menu__info">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
                <span>{user?.roleLabel}</span>
              </div>
              <Link to="/perfil" onClick={() => setMenuOpen(false)}>
                <UserRound size={16} /> Mi perfil
              </Link>
              <button type="button" onClick={handleLogout}>
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
