import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import tokenStorage from '../utils/tokenStorage';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => tokenStorage.getToken());
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());

  const timeoutMinutes = parseInt(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES, 10) || 30;
  const idleTimeoutMs = timeoutMinutes * 60 * 1000;

  const logout = useCallback((reason = null) => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    if (reason && window.location.pathname !== '/login') {
      window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
    }
  }, []);

  const login = useCallback((newToken, newUser) => {
    tokenStorage.setToken(newToken);
    tokenStorage.setUser(newUser);
    setToken(newToken);
    setUser(newUser);
    lastActivityRef.current = Date.now();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.getToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await authService.getMe();
      if (data && data.user) {
        tokenStorage.setUser(data.user);
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      // If 401, axios interceptor handles redirect
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Idle timeout tracking
  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityRef.current > idleTimeoutMs) {
        logout('Session timed out due to inactivity');
      }
    }, 15000); // Check every 15 seconds

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, [token, idleTimeoutMs, logout]);

  const hasPermission = useCallback((permissionKey) => {
    if (!user || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permissionKey);
  }, [user]);

  const hasRole = useCallback((roleName) => {
    if (!user || !Array.isArray(user.roles)) return false;
    return user.roles.some((r) => (typeof r === 'string' ? r : r.name).toLowerCase() === roleName.toLowerCase());
  }, [user]);

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    refreshUser,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
