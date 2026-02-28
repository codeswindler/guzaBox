import axios from "axios";

// Determine API base URL
// In production, NEXT_PUBLIC_API_URL should be set to the backend URL
// If not set, try to infer from current hostname
const getApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const trimmed = envUrl.trim();
    // If it's localhost and we're in browser, we need to use the actual backend URL
    // or rely on a reverse proxy
    if (trimmed && trimmed !== "http://localhost:4000") {
      return trimmed;
    }
  }
  
  if (typeof window !== "undefined") {
    // In browser: check if we're on localhost
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // If on localhost, try localhost:4000 (for local dev)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4000";
    }
    
    // In production, try to construct backend URL from current hostname
    // Option 1: Same domain, different port (if backend is exposed)
    // Option 2: Use relative URLs (if reverse proxy is set up)
    // For now, try same origin with :4000, fallback to empty (relative)
    // This assumes either:
    // - Backend is exposed on :4000 of same domain
    // - Or there's a reverse proxy handling /api/* -> backend
    return ""; // Empty means relative URLs - requires reverse proxy or Next.js rewrites
  }
  
  // Server-side default
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
