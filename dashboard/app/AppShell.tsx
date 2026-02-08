"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("jazabox_token"));

  useEffect(() => {
    if (!isLogin && !hasToken) {
      router.replace("/login");
    }
  }, [hasToken, isLogin, router]);

  return (
    <div className={isLogin ? "app-shell login-shell" : "app-shell"}>
      {!isLogin && (
        <header className="top-bar">
          <div className="brand">
            <span className="brand-mark">JZ</span>
            <div>
              <div className="brand-title">JazaBox</div>
              <div className="brand-subtitle">Admin Console</div>
            </div>
          </div>
          <nav className="nav">
            <Link href="/">Overview</Link>
            <Link href="/transactions">Transactions</Link>
            <Link href="/payouts">Payouts</Link>
            <Link href="/analytics">Analytics</Link>
            <Link href="/simulator">USSD Simulator</Link>
          </nav>
          <button
            className="profile-button"
            type="button"
            onClick={() => {
              localStorage.removeItem("jazabox_token");
              router.replace("/login");
            }}
            aria-label="Logout"
            title="Logout"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5c0-2.5-3.58-4.5-8-4.5z" />
            </svg>
          </button>
        </header>
      )}
      <main className={isLogin ? "page login-page" : "page"}>{children}</main>
    </div>
  );
}
