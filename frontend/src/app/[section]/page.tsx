import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResearchApp from "@/components/research-app";

const sections: Record<string, string> = {
  "research-opportunities": "ประกาศงานวิจัย",
  "research-applications": "ใบสมัคร",
  "research-assistants": "ผู้ช่วยวิจัย",
  "research-tasks": "งานที่มอบหมาย",
  "progress-reports": "รายงานความคืบหน้า",
  "research-evaluations": "ผลการประเมิน",
};
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: sections[section] ?? "ไม่พบหน้า" };
}
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections[section]) notFound();
  return <ResearchApp />;
}
