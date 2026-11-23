import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { alertsApi } from '../../api/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AppLayout() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const canReadAlerts = hasPermission('alerts:read');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const isChatPage = location.pathname === '/ia';

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await alertsApi.summary();
        if (active) setAlertCount(response.data.attention || 0);
      } catch { /* el contador no bloquea la navegación */ }
    };
    if (canReadAlerts) load();
    const refresh = () => { if (canReadAlerts) load(); };
    window.addEventListener('stockalert:refresh-alerts', refresh);
    return () => {
      active = false;
      window.removeEventListener('stockalert:refresh-alerts', refresh);
    };
  }, [canReadAlerts]);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alertCount={alertCount} />
      <div className="app-main">
        <Topbar onMenu={() => setSidebarOpen(true)} alertCount={alertCount} />
        <main className={`app-content${isChatPage ? ' app-content--chat' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
