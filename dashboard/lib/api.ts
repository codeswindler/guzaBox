import axios from "axios";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://localhost:4000")
).trim();

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jazabox_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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
