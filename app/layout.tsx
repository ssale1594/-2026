import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteName } from "@/lib/seo";

// الموقع كله عربي (lang="ar" dir="rtl")، فخط اللاتيني وحده (Geist) كان
// يترك كل نص عربي يُعرض بخط النظام الاحتياطي بلا أي أثر فعلي. IBM Plex
// Sans Arabic يغطي العربي واللاتيني بنفس العائلة، فلا يتكسر تناسق الأرقام
// والحروف الإنجليزية داخل النص العربي.
const bodyFont = IBM_Plex_Sans_Arabic({
  variable: "--font-body",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: siteName,
  description: "دليل محلي لمحلات ومنتجات وخدمات الزلفي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${bodyFont.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
