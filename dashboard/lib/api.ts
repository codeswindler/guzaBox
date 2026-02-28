import axios from "axios";

// Determine API base URL
// In production, nginx proxies /api/* to backend (localhost:4000)
// For local dev, use localhost:4000 directly
const getApiBaseUrl = () => {
  // Allow override via environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.trim();
  }
  
  if (typeof window !== "undefined") {
    // In browser: check if we're on localhost
    const hostname = window.location.hostname;
    
    // If on localhost, use localhost:4000 directly (for local dev)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4000";
    }
    
    // In production, use /api prefix which nginx proxies to backend
    return "/api";
  }
  
  // Server-side default (for SSR)
  return "http://localhost:4000";
};

const apiBaseUrl = getApiBaseUrl();

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // 30 second timeout
});

// Add request interceptor for auth token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jazabox_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log 404 errors for debugging
    if (error.response?.status === 404) {
      console.error(`API 404 Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        baseURL: apiBaseUrl,
        fullURL: error.config?.baseURL + error.config?.url,
      });
    }
    return Promise.reject(error);
  }
);

// Session management methods
export const getSessions = (securityKey?: string) => {
  const params = securityKey ? { securityKey } : {};
  return api.get("/auth/sessions", { params });
};
export const revokeSession = (sessionId: string, securityKey?: string) => {
  const params = securityKey ? { securityKey } : {};
  return api.delete(`/auth/sessions/${sessionId}`, { params });
};
export const logout = (securityKey?: string) => {
  const params = securityKey ? { securityKey } : {};
  return api.post("/auth/logout", null, { params });
};

export default api;
