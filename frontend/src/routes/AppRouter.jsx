import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import ProductsPage from '../pages/ProductsPage.jsx';
import CategoriesPage from '../pages/CategoriesPage.jsx';
import SuppliersPage from '../pages/SuppliersPage.jsx';
import MovementsPage from '../pages/MovementsPage.jsx';
import AlertsPage from '../pages/AlertsPage.jsx';
import IndicatorsPage from '../pages/IndicatorsPage.jsx';
import AiInsightsPage from '../pages/AiInsightsPage.jsx';
import ReportsPage from '../pages/ReportsPage.jsx';
import SuperadminPage from '../pages/SuperadminPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';

function Guard({ permission, children }) {
  return <ProtectedRoute permission={permission}>{children}</ProtectedRoute>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Guard permission="dashboard:read"><DashboardPage /></Guard>} />
        <Route path="productos" element={<Guard permission="products:read"><ProductsPage /></Guard>} />
        <Route path="categorias" element={<Guard permission="categories:read"><CategoriesPage /></Guard>} />
        <Route path="proveedores" element={<Guard permission="suppliers:read"><SuppliersPage /></Guard>} />
        <Route path="movimientos" element={<Guard permission="movements:read"><MovementsPage /></Guard>} />
        <Route path="alertas" element={<Guard permission="alerts:read"><AlertsPage /></Guard>} />
        <Route path="indicadores" element={<Guard permission="indicators:read"><IndicatorsPage /></Guard>} />
        <Route path="ia" element={<Guard permission="indicators:read"><AiInsightsPage /></Guard>} />
        <Route path="reportes" element={<Guard permission="reports:read"><ReportsPage /></Guard>} />
        <Route path="superadmin" element={<Guard permission="users:read"><SuperadminPage /></Guard>} />
        <Route path="usuarios" element={<Guard permission="users:read"><Navigate to="/superadmin?tab=usuarios" replace /></Guard>} />
        <Route path="perfil" element={<Guard permission="profile:read"><ProfilePage /></Guard>} />
        <Route path="acceso-denegado" element={<ForbiddenPage />} />
        <Route path="404" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
