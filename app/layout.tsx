import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Home_Made — Stock",
  description: "Gestion stock matériaux & consommables — terrasses sur plots",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#5f5240",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
          {children}
        </main>
        <footer className="no-print mx-auto w-full max-w-5xl px-4 py-4 text-xs text-brand-700/70">
          Home_Made · gestion de stock
        </footer>
      </body>
    </html>
  );
}
