import "./styles.css";
import CardTone from "./CardTone";
import SeedData from "./SeedData";
import AppShell from "./AppShell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
