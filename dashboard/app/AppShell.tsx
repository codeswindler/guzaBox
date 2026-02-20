"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [isReady, setIsReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inactivityTimer = useRef<number | null>(null);
  const warningTimer = useRef<number | null>(null);
  const countdownInterval = useRef<number | null>(null);
  const resetSessionRef = useRef<(() => void) | null>(null);
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("jazabox_token"));

  const logout = () => {
    // Clear all timers
    if (inactivityTimer.current) {
      window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (warningTimer.current) {
      window.clearTimeout(warningTimer.current);
      warningTimer.current = null;
    }
    if (countdownInterval.current) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setShowTimeoutModal(false);
    localStorage.removeItem("jazabox_token");
    router.replace("/login");
  };

  const resetSession = () => {
    // Clear all timers
    if (inactivityTimer.current) {
      window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (warningTimer.current) {
      window.clearTimeout(warningTimer.current);
      warningTimer.current = null;
    }
    if (countdownInterval.current) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setShowTimeoutModal(false);
    setCountdown(30);
    // Call the reset function from useEffect
    if (resetSessionRef.current) {
      resetSessionRef.current();
    }
  };

  useEffect(() => {
    if (isLogin) return;
    
    const startSessionTimers = () => {
      // Show warning popup after 4.5 minutes (270 seconds)
      warningTimer.current = window.setTimeout(() => {
        setShowTimeoutModal(true);
        setCountdown(30);
        
        // Start countdown
        countdownInterval.current = window.setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              // Time's up, logout
              if (countdownInterval.current) {
                window.clearInterval(countdownInterval.current);
                countdownInterval.current = null;
              }
              logout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 4.5 * 60 * 1000); // 4.5 minutes

      // Full logout after 5 minutes
      inactivityTimer.current = window.setTimeout(() => {
        logout();
      }, 5 * 60 * 1000); // 5 minutes
    };
    
    const resetTimer = () => {
      // Clear existing timers
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      if (warningTimer.current) {
        window.clearTimeout(warningTimer.current);
        warningTimer.current = null;
      }
      if (countdownInterval.current) {
        window.clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      
      // Hide modal if user becomes active
      setShowTimeoutModal(false);
      setCountdown(30);
      
      // Restart timers
      startSessionTimers();
    };
    
    // Store reset function in ref so resetSession can call it
    resetSessionRef.current = resetTimer;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    startSessionTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      if (warningTimer.current) {
        window.clearTimeout(warningTimer.current);
        warningTimer.current = null;
      }
      if (countdownInterval.current) {
        window.clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
  }, [isLogin]);

  useEffect(() => {
    if (!isLogin && !hasToken) {
      router.replace("/login");
    }
    if (!isLogin) {
      setIsReady(Boolean(hasToken));
    } else {
      setIsReady(true);
    }
  }, [hasToken, isLogin, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".profile-menu")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  if (!isReady) {
    return (
      <div className="app-shell login-shell">
        <div className="page login-page">
          <div className="login-hero">
            <div className="login-overlay" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isLogin ? "app-shell login-shell" : "app-shell"}>
      {!isLogin && (
        <header className="top-bar">
          <div className="brand">
            <span className="brand-mark">KB</span>
            <div>
              <div className="brand-title">Kwachua Box</div>
              <div className="brand-subtitle">Admin Console</div>
            </div>
          </div>
          <nav className="nav">
            <Link href="/">Overview</Link>
            <Link href="/transactions">Transactions</Link>
            <Link href="/instant-win">Instant Wins</Link>
            <Link href="/payouts">Collections & Payouts</Link>
            <Link href="/analytics">Analytics</Link>
            <Link href="/simulator">USSD Simulator</Link>
          </nav>
          <div className="profile-menu">
            <button
              className="profile-button"
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Profile"
              title="Profile"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5c0-2.5-3.58-4.5-8-4.5z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="profile-dropdown">
                <Link href="/security" onClick={() => setMenuOpen(false)}>
                  Security
                </Link>
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>
      )}
      <main className={isLogin ? "page login-page" : "page"}>{children}</main>
      
      {/* Session Timeout Modal */}
      {showTimeoutModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "2px solid #7c3aed",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "16px",
                color: "#fff",
                fontSize: "1.5rem",
                fontWeight: 700,
              }}
            >
              Session Timeout Warning
            </h3>
            <p
              style={{
                marginBottom: "24px",
                color: "#ccc",
                fontSize: "1rem",
                lineHeight: "1.5",
              }}
            >
              Your session will expire in{" "}
              <span
                style={{
                  color: "#f59e0b",
                  fontWeight: 700,
                  fontSize: "1.2rem",
                }}
              >
                {countdown}
              </span>{" "}
              seconds due to inactivity.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#444",
                  color: "#fff",
                  border: "1px solid #666",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Log Out
              </button>
              <button
                type="button"
                onClick={resetSession}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
