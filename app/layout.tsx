import type { Metadata } from "next";
import { Unbounded, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { FloatingMagic } from "@/components/FloatingMagic";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Штатив ✳ посты из новостей",
  description:
    "Парсит RSS-источники, генерирует уникальные посты с картинками через AI и создаёт мотивационные пины.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${unbounded.variable} ${inter.variable} font-body antialiased`}>
        <Providers>
          <FloatingMagic />
          <Nav />
          {children}
          <footer className="relative z-10 border-t-2 border-ink/10 py-8 text-center text-xs text-ink/40">
            ШТАТИВ ✳ посты из новостей и пинов · всё генерируется локально, ничего не публикуется
          </footer>
        </Providers>
      </body>
    </html>
  );
}
