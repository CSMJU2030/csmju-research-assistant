"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CsmjuAppShell, type NavItem } from "@/csmju";
import { api, type Me } from "@/lib/api";

const nav: NavItem[] = [
  { label: "ภาพรวม", labelEn: "Overview", href: "/", icon: "dashboard" },
  { label: "ประกาศงานวิจัย", labelEn: "Opportunities", href: "/research-opportunities", icon: "campaign" },
  { label: "ใบสมัคร", labelEn: "Applications", href: "/research-applications", icon: "description" },
  { label: "ผู้ช่วยวิจัย", labelEn: "Assistants", href: "/research-assistants", icon: "group" },
  { label: "งานที่มอบหมาย", labelEn: "Tasks", href: "/research-tasks", icon: "event" },
  { label: "รายงานความคืบหน้า", labelEn: "Progress", href: "/progress-reports", icon: "receipt" },
  { label: "ผลการประเมิน", labelEn: "Evaluations", href: "/research-evaluations", icon: "school" },
];

export function ResearchShell({ children, coreHubUrl }: { children: ReactNode; coreHubUrl?: string }) {
  const [me, setMe] = useState<Me>();
  useEffect(() => {
    let active = true;
    api<Me>("me").then((response) => { if (active) setMe(response.data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const roleLabel = me?.subsystemRole === "guest" ? "นักศึกษา" : me?.subsystemRole === "editor" ? "อาจารย์" : me?.subsystemRole === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";
  return <CsmjuAppShell displayName="ระบบจัดการผู้ช่วยวิจัย" nav={nav} coreHubUrl={coreHubUrl}
    user={{ initials: me?.id?.slice(0, 2).toUpperCase() || "CS", roleLabel }}>
    {children}
  </CsmjuAppShell>;
}
