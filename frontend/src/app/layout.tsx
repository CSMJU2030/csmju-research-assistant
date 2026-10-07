import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import { ResearchShell } from "@/components/research-shell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const noto = Noto_Sans_Thai({ variable: "--font-noto-thai", subsets: ["latin", "thai"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { template: "%s · ระบบจัดการผู้ช่วยวิจัย · CSMJU", default: "ระบบจัดการผู้ช่วยวิจัย · CSMJU" },
  description: "ประกาศรับสมัครและจัดการงานผู้ช่วยวิจัย",
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th" className={`${jakarta.variable} ${noto.variable} h-full antialiased`}>
    <body className="min-h-full bg-background text-on-surface">
      <ResearchShell coreHubUrl={process.env.CORE_HUB_WEB_URL}>{children}</ResearchShell>
    </body>
  </html>;
}
