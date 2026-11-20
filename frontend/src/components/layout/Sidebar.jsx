import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, BellRing, ChartNoAxesCombined,
  Tags, Truck, FileBarChart, Users, UserRound, ShieldCheck, X, BrainCircuit,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Badge from '../ui/Badge.jsx';

const NAV = [
  { to: '/', label: 'Panel principal', icon: LayoutDashboard, permission: 'dashboard:read', end: true },
  { to: '/productos', label: 'Productos', icon: Package, permission: 'products:read' },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight, permission: 'movements:read' },
  { to: '/alertas', label: 'Alertas', icon: BellRing, permission: 'alerts:read', badge: 'alerts' },
  { to: '/indicadores', label: 'Indicadores', icon: ChartNoAxesCombined, permission: 'indicators:read' },
  { to: '/ia', label: 'Asistente IA', icon: BrainCircuit, permission: 'indicators:read' },
  { to: '/categorias', label: 'Categorías', icon: Tags, permission: 'categories:read' },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, permission: 'suppliers:read' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart, permission: 'reports:read' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'profile:read' },
  { to: '/perfil', label: 'Mi perfil', icon: UserRound, permission: 'profile:read' },
];

export default function Sidebar({ open, onClose, alertCount = 0 }) {
  const { hasPermission, user } = useAuth();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="brand-mark"><ShieldCheck size={22} /></div>
          <div>
            <strong>STOCKALERT</strong>
            <span>Control de inventarios</span>
          </div>
          <button type="button" className="icon-button sidebar__close" onClick={onClose} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__section">MENÚ PRINCIPAL</p>
          {NAV.filter((item) => hasPermission(item.permission)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge === 'alerts' && alertCount > 0 && <Badge tone="danger">{alertCount}</Badge>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.roleLabel}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
