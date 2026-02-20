"use client";

import { useEffect, useState } from "react";
import { getSessions, revokeSession, logout as apiLogout } from "../../lib/api";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    deviceFingerprint: string;
  };
  lastActivityAt: string;
  createdAt: string;
};

export default function SecurityPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setError("");
      const response = await getSessions();
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

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to revoke this session?")) return;

    try {
      await revokeSession(sessionId);
      await loadSessions();
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
      const otherSessions = sessions.filter(
        (s) => s.id !== currentSessionId
      );
      await Promise.all(
        otherSessions.map((s) => revokeSession(s.id).catch(() => {}))
      );
      await loadSessions();
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

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 30000); // Refresh every 30 seconds
    return () => clearInterval(timer);
  }, []);

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
                      <td className="mono">{session.deviceInfo.ip}</td>
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
