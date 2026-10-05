import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { BRAND } from "@/config/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: `${BRAND.empresa} · ${BRAND.sistema}`,
    template: `%s · ${BRAND.empresa}`,
  },
  description: `${BRAND.sistema} para distribuidora de materiales de construcción. Demo de ${BRAND.agencia}.`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: 8,
              border: "1px solid #E6E5E1",
              boxShadow: "0 4px 16px rgba(20,20,19,0.08)",
              fontSize: 13,
              color: "#141413",
            },
          }}
        />
      </body>
    </html>
  );
}
