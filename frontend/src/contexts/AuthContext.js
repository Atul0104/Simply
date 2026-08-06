import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
axios.defaults.withCredentials = true;

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message)
      .filter(Boolean)
      .join('. ') || fallback;
  }
  if (detail && typeof detail === 'object') return detail.msg || detail.message || fallback;
  return fallback;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialRefreshStarted = useRef(false);

  const establishSession = useCallback((accessToken, userData) => {
    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    setToken(accessToken);
    setUser(userData);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const response = await axios.post(`${API_URL}/auth/refresh`, null, { _skipAuthRefresh: true });
    establishSession(response.data.access_token, response.data.user);
    return response.data.access_token;
  }, [establishSession]);

  useEffect(() => {
    if (initialRefreshStarted.current) return;
    initialRefreshStarted.current = true;
    // Remove tokens written by older preview builds; refresh credentials now live in an HttpOnly cookie.
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    refreshAccessToken().catch(() => {
      delete axios.defaults.headers.common.Authorization;
      setUser(null);
      setToken(null);
    }).finally(() => setLoading(false));

  }, [refreshAccessToken]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const request = error.config;
        if (error.response?.status === 401 && request && !request._retry && !request._skipAuthRefresh) {
          request._retry = true;
          try {
            const newToken = await refreshAccessToken();
            request.headers = request.headers || {};
            request.headers.Authorization = `Bearer ${newToken}`;
            return axios(request);
          } catch (_) {
            delete axios.defaults.headers.common.Authorization;
            setUser(null);
            setToken(null);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshAccessToken]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      establishSession(access_token, userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Login failed') };
    }
  };

  const register = async (email, password, name, phone, role = 'customer') => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        password,
        name,
        phone: phone || null,
        role
      });
      const { access_token, user: userData } = response.data;
      
      establishSession(access_token, userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Registration failed') };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, null, { _skipAuthRefresh: true });
    } catch (_) {
      // Local sign-out must still complete if the network is unavailable.
    }
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    setToken(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, establishSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
