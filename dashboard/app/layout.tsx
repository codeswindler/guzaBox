import "./styles.css";
import CardTone from "./CardTone";
import SeedData from "./SeedData";
import AppShell from "./AppShell";

export const metadata = {
  title: "Kwachua Box Admin",
  description: "Admin dashboard",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/favicon.ico',
  },
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
