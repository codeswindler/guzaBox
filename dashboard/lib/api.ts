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
export const getSessions = () => api.get("/auth/sessions");
export const revokeSession = (sessionId: string) =>
  api.delete(`/auth/sessions/${sessionId}`);
export const logout = () => api.post("/auth/logout");

export default api;
