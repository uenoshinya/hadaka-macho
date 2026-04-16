import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "裸マッチョへの道",
  description: "筋トレ・食事・体重管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FFF8EC]">
        {/* ヘッダーナビゲーション */}
        <header className="sticky top-0 z-50 bg-[#2C1A0E] shadow-md">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🦁</span>
              <span className="text-[#D4A017] font-bold tracking-wider text-sm">裸マッチョへの道</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/workout"
                className="px-3 py-1.5 text-xs font-semibold text-[#FFF8EC] hover:text-[#D4A017] hover:bg-[#3d2410] rounded-lg transition-colors"
              >
                💪 筋トレ
              </Link>
              <Link
                href="/meals"
                className="px-3 py-1.5 text-xs font-semibold text-[#FFF8EC] hover:text-[#D4A017] hover:bg-[#3d2410] rounded-lg transition-colors"
              >
                🍽️ 食事
              </Link>
              <Link
                href="/weight"
                className="px-3 py-1.5 text-xs font-semibold text-[#FFF8EC] hover:text-[#D4A017] hover:bg-[#3d2410] rounded-lg transition-colors"
              >
                ⚖️ 体重
              </Link>
            </nav>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        {/* フッター */}
        <footer className="py-4 text-center text-xs text-[#5C3D11]/60">
          🦁 Keep pushing. Stay hungry.
        </footer>
      </body>
    </html>
  );
}
