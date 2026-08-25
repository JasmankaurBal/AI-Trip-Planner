import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";
import { setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // Guests on public pages: skip /me (no session) to avoid noisy 401s
    const path = window.location.pathname;
    const isAppRoute = path.startsWith("/app");
    if (!isAppRoute) {
      setUser(false);
      setReady(true);
      return;
    }
    refresh();
  }, [refresh]);

  const applySession = (data) => {
    setToken(null);
    setUser(data);
    setReady(true);
  };

  const login = async (email, password) => applySession(await authApi.login({ email, password }));
  const register = async (name, email, password) => applySession(await authApi.register({ name, email, password }));

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
