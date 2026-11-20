import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { alertsApi } from '../../api/endpoints.js';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await alertsApi.summary();
        if (active) setAlertCount(response.data.attention || 0);
      } catch { /* el contador no bloquea la navegación */ }
    };
    load();
    window.addEventListener('stockalert:refresh-alerts', load);
    return () => {
      active = false;
      window.removeEventListener('stockalert:refresh-alerts', load);
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alertCount={alertCount} />
      <div className="app-main">
        <Topbar onMenu={() => setSidebarOpen(true)} alertCount={alertCount} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
