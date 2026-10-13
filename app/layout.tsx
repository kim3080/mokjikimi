import type { Metadata, Viewport } from "next";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import "./globals.css";

export const metadata: Metadata = {
  title: "목지키미 · 나를 위한 집중 공간",
  description: "바른 자세로, 함께 오래. AI 자세 감지와 함께하는 소셜 뽀모도로 스터디룸",
};

export const viewport: Viewport = {
  themeColor: "#245c46",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-shell">
          <a className="skip-link" href="#main-content">
            본문으로 건너뛰기
          </a>
          <Header />
          {children}
          <footer className="site-footer">
            <span>
              <Icon name="leaf" size={15} />
              목지키미
            </span>
            <p>바른 자세로, 함께 오래.</p>
            <span className="footer-version">첫 번째 새싹 · 베타</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
