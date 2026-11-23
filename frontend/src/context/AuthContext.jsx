import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { clearToken, hasToken, saveToken } from '../api/client.js';
import { permissionsFor } from '../config/permissions.js';

const AuthContext = createContext(null);

export function homePathFor(user) {
  if (user?.role === 'SUPERADMINISTRADOR') return '/superadmin';
  if (user?.role === 'ENCARGADO_INVENTARIO') return '/movimientos';
  return '/';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!hasToken()) {
      setLoading(false);
      return undefined;
    }
    authApi.me()
      .then((response) => { if (active) setUser(response.data); })
      .catch(() => clearToken())
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('stockalert:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('stockalert:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    saveToken(response.data.token);
    // /auth/me es la fuente de verdad para permisos y evita el bug post-login.
    const profile = await authApi.me();
    setUser(profile.data);
    return profile.data;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* la sesión local se cierra de todos modos */ }
    clearToken();
    setUser(null);
  }, []);

  const permissions = useMemo(
    () => permissionsFor(user?.role, user?.permissions),
    [user?.role, user?.permissions],
  );

  const hasPermission = useCallback(
    (permission) => permissions.includes(permission),
    [permissions],
  );

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    permissions,
    hasPermission,
    homePath: homePathFor(user),
    isSuperAdmin: user?.role === 'SUPERADMINISTRADOR',
    isAdmin: user?.role === 'ADMINISTRADOR',
    isManager: user?.role === 'ENCARGADO_INVENTARIO',
    isReadOnly: user?.role === 'CONSULTA',
  }), [user, loading, login, logout, permissions, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
