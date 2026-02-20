"use client";

import { useEffect, useState } from "react";
import { getSessions, revokeSession, logout as apiLogout } from "../../lib/api";
import { useRouter, useSearchParams } from "next/navigation";

type Session = {
  id: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    deviceFingerprint: string;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      countryCode?: string;
      location?: string;
    } | null;
  };
  ip: string;
  userAgent: string;
  location: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    location?: string;
  } | null;
  lastActivityAt: string;
  createdAt: string;
  uptime: string;
  uptimeMs: number;
};

export default function SecurityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [showAccessPrompt, setShowAccessPrompt] = useState(true);
  const [accessError, setAccessError] = useState("");

  const loadSessions = async (key?: string) => {
    try {
      setError("");
      const response = await getSessions(key);
      const sessionList = response.data || [];
      setSessions(sessionList);

      // Identify current session by matching device fingerprint
      if (typeof window !== "undefined") {
        const currentFingerprint = getCurrentDeviceFingerprint();
        const current = sessionList.find(
          (s: Session) => s.deviceInfo.deviceFingerprint === currentFingerprint
        );
        if (current) {
          setCurrentSessionId(current.id);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDeviceFingerprint = (): string => {
    if (typeof window === "undefined") return "";
    // Simple fingerprint based on available browser info
    const userAgent = navigator.userAgent;
    const language = navigator.language;
    const data = `${userAgent}|${language}`;
    // Use a simple hash (in production, use crypto.subtle)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 32);
  };

  const getSecurityKey = (): string | null => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("security_page_access");
    }
    return null;
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to revoke this session?")) return;

    try {
      const key = getSecurityKey();
      await revokeSession(sessionId, key || undefined);
      await loadSessions(key || undefined);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to revoke session");
    }
  };

  const handleRevokeAllOthers = async () => {
    if (
      !confirm(
        "Are you sure you want to revoke all other sessions? You will remain logged in on this device."
      )
    ) {
      return;
    }

    try {
      const key = getSecurityKey();
      const otherSessions = sessions.filter(
        (s) => s.id !== currentSessionId
      );
      await Promise.all(
        otherSessions.map((s) => revokeSession(s.id, key || undefined).catch(() => {}))
      );
      await loadSessions(key || undefined);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to revoke sessions");
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;

    try {
      await apiLogout();
      localStorage.removeItem("jazabox_token");
      router.replace("/login");
    } catch (err: any) {
      // Even if API call fails, clear token and redirect
      localStorage.removeItem("jazabox_token");
      router.replace("/login");
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const getDeviceName = (userAgent: string): string => {
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome"))
      return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Mobile")) return "Mobile Browser";
    return "Unknown Browser";
  };

  const checkAccessKey = async (): Promise<boolean> => {
    const key = searchParams.get("key");
    if (key) {
      // Validate key with backend
      try {
        await getSessions(key);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("security_page_access", key);
        }
        setShowAccessPrompt(false);
        return true;
      } catch (err: any) {
        setAccessError(err.response?.data?.message || "Invalid access key");
        return false;
      }
    }
    
    // Check if key is stored in sessionStorage
    if (typeof window !== "undefined") {
      const storedKey = sessionStorage.getItem("security_page_access");
      if (storedKey) {
        // Validate stored key with backend
        try {
          await getSessions(storedKey);
          setShowAccessPrompt(false);
          return true;
        } catch (err: any) {
          // Stored key is invalid, clear it
          sessionStorage.removeItem("security_page_access");
          return false;
        }
      }
    }
    
    return false;
  };

  const handleAccessKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError("");
    
    if (!accessKey) {
      setAccessError("Please enter an access key");
      return;
    }
    
    // Validate key with backend
    try {
      await getSessions(accessKey);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("security_page_access", accessKey);
      }
      setShowAccessPrompt(false);
      await loadSessions(accessKey);
    } catch (err: any) {
      setAccessError(err.response?.data?.message || "Invalid access key");
    }
  };

  useEffect(() => {
    const init = async () => {
      const hasAccess = await checkAccessKey();
      if (hasAccess) {
        const key = getSecurityKey();
        await loadSessions(key || undefined);
        const timer = setInterval(() => loadSessions(key || undefined), 30000); // Refresh every 30 seconds
        return () => clearInterval(timer);
      }
    };
    init();
  }, [searchParams]);

  if (showAccessPrompt) {
    return (
      <div>
        <h2 className="page-title">Security</h2>
        <div className="card demo-card" style={{ maxWidth: "400px", margin: "2rem auto" }}>
          <h3 style={{ marginTop: 0 }}>Access Required</h3>
          <p className="subtle">Enter the security page access key to continue.</p>
          <form onSubmit={handleAccessKeySubmit}>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Enter access key"
              style={{
                width: "100%",
                padding: "0.75rem",
                marginBottom: "1rem",
                background: "#2a2a2a",
                border: "1px solid #444",
                borderRadius: "6px",
                color: "white",
                fontSize: "1rem",
              }}
              autoFocus
            />
            {accessError && (
              <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{accessError}</p>
            )}
            <button
              type="submit"
              className="button"
              style={{ width: "100%" }}
            >
              Access Security Page
            </button>
          </form>
          <p className="subtle" style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
            You can also access via URL: /security?key=YOUR_KEY
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Security</h2>
      <p className="subtle">
        Manage your active sessions and logged-in devices.
      </p>

      {error && <p className="subtle" style={{ color: "#ef4444" }}>{error}</p>}

      {loading ? (
        <div className="card demo-card">
          <p className="subtle">Loading sessions...</p>
        </div>
      ) : (
        <>
          <div className="card demo-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0 }}>Active Sessions</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {sessions.filter((s) => s.id !== currentSessionId).length > 0 && (
                  <button
                    className="button"
                    onClick={handleRevokeAllOthers}
                    style={{ background: "#f59e0b" }}
                  >
                    Revoke All Other Sessions
                  </button>
                )}
                <button
                  className="button"
                  onClick={handleLogout}
                  style={{ background: "#ef4444" }}
                >
                  Log Out
                </button>
              </div>
            </div>

            {sessions.length === 0 ? (
              <p className="subtle">No active sessions found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>IP Address</th>
                    <th>Location</th>
                    <th>Uptime</th>
                    <th>Last Activity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div>
                          <strong>{getDeviceName(session.deviceInfo.userAgent)}</strong>
                          {session.id === currentSessionId && (
                            <span
                              style={{
                                marginLeft: "8px",
                                padding: "2px 8px",
                                background: "#10b981",
                                color: "white",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                              }}
                            >
                              CURRENT
                            </span>
                          )}
                        </div>
                        <div className="subtle" style={{ fontSize: "0.875rem" }}>
                          {session.deviceInfo.userAgent.substring(0, 60)}
                          {session.deviceInfo.userAgent.length > 60 ? "..." : ""}
                        </div>
                      </td>
                      <td className="mono">{session.ip || session.deviceInfo.ip}</td>
                      <td className="table-muted">
                        {session.location?.location || session.deviceInfo.location?.location || "—"}
                      </td>
                      <td className="table-muted">{session.uptime}</td>
                      <td className="table-muted">
                        {formatDateTime(session.lastActivityAt)}
                      </td>
                      <td>
                        {session.id === currentSessionId ? (
                          <span className="subtle">Current session</span>
                        ) : (
                          <button
                            className="button"
                            onClick={() => handleRevokeSession(session.id)}
                            style={{
                              background: "#ef4444",
                              padding: "0.25rem 0.75rem",
                              fontSize: "0.875rem",
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
