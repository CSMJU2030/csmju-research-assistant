import Link from "next/link";
import { Inbox } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { StatusBadge, cardClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/csmju";

export const labels: Record<string, string> = {
  draft: "ฉบับร่าง", open: "เปิดรับสมัคร", closed: "ปิดรับสมัคร", pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว", rejected: "ไม่ผ่านการคัดเลือก", cancelled: "ยกเลิกแล้ว",
  todo: "ยังไม่เริ่ม", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น",
  low: "ต่ำ", medium: "ปานกลาง", high: "สูง",
};
export const researchCardClass = cardClass;
export const researchInputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container";
export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const style = variant === "primary" ? primaryButtonClass : variant === "danger" ? dangerButtonClass : secondaryButtonClass;
  return <button {...props} className={`${style} inline-flex min-h-11 items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container disabled:cursor-not-allowed disabled:opacity-40 ${className}`} />;
}
export function Badge({ value }: { value: string }) {
  const tone = ["approved", "completed", "open"].includes(value) ? "success" : ["rejected", "cancelled", "high"].includes(value) ? "error" : ["pending", "todo", "medium"].includes(value) ? "warning" : "neutral";
  return <StatusBadge tone={tone} label={labels[value] ?? value} />;
}
export function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return <div className={`${cardClass} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
    <Inbox className="h-8 w-8 text-outline" aria-hidden="true" />
    <h2 className="font-display text-headline-md">{filtered ? "ไม่พบข้อมูลที่ตรงกับการค้นหา" : "ยังไม่มีรายการในส่วนนี้"}</h2>
    <p className="text-body-md text-on-surface-variant">{filtered ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "รายการจะแสดงที่นี่เมื่อมีการดำเนินการ"}</p>
  </div>;
}
export function Skeleton() {
  return <div role="status" aria-label="กำลังโหลดข้อมูล" className="space-y-4">{[1, 2, 3].map(i => <div className={`${cardClass} h-28 animate-pulse bg-surface-container`} key={i} />)}</div>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className={`${cardClass} space-y-4 px-6 py-8 text-center`}>
    <p className="text-body-md text-error">{message}</p>
    {retry ? <Button onClick={retry}>ลองอีกครั้ง</Button> : <Link className={secondaryButtonClass} href="/">กลับหน้าหลัก</Link>}
  </div>;
}
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ไม่ระบุ" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}
