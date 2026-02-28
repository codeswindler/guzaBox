import axios from "axios";

// Determine API base URL
// In production, nginx has direct routes for /admin, /auth, /payments, /ussd
// So we use empty base URL (relative paths) to match nginx routing
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
    
    // In production, use empty string (relative URLs) to match nginx direct routes
    // Nginx has: location ~ ^/(admin|auth|payments|ussd) which handles these directly
    return "";
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
    // Log all API errors for debugging
    console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      baseURL: apiBaseUrl,
      fullURL: error.config?.baseURL + error.config?.url,
      data: error.response?.data,
      message: error.message,
    });
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
