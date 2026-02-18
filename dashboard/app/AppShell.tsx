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
  const inactivityTimer = useRef<number | null>(null);
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("jazabox_token"));

  const logout = () => {
    localStorage.removeItem("jazabox_token");
    router.replace("/login");
  };

  useEffect(() => {
    if (isLogin) return;
    const resetTimer = () => {
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = window.setTimeout(() => {
        logout();
      }, 5 * 60 * 1000);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
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
            <span className="brand-mark">LB</span>
            <div>
              <div className="brand-title">Lucky Box</div>
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
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>
      )}
      <main className={isLogin ? "page login-page" : "page"}>{children}</main>
    </div>
  );
}
