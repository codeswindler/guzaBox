import "./styles.css";
import Link from "next/link";
import CardTone from "./CardTone";
import SeedData from "./SeedData";

export const metadata = {
  title: "JazaBox Admin",
  description: "Admin dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CardTone />
        <SeedData />
        <div className="app-shell">
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
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
