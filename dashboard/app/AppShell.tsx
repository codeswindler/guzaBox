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
        </header>
      )}
      <main className={isLogin ? "page login-page" : "page"}>{children}</main>
    </div>
  );
}
