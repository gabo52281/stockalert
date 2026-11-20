import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { clearToken, hasToken, saveToken } from '../api/client.js';

const AuthContext = createContext(null);

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
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* la sesión local se cierra de todos modos */ }
    clearToken();
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === 'ADMINISTRADOR') return true;
    return Boolean(user.permissions?.includes(permission));
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    hasPermission,
    isAdmin: user?.role === 'ADMINISTRADOR',
    isManager: user?.role === 'ENCARGADO_INVENTARIO',
    isReadOnly: user?.role === 'CONSULTA',
  }), [user, loading, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
