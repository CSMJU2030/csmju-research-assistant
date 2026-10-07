"use client";
import { useEffect, useState } from 'react';
import { api, type Me, type Opportunity, type Application, type Task, type Report } from '../lib/api';
import { Badge, Button, ErrorState, Skeleton, formatDate } from './research-ui';
import { cardClass } from '@/csmju';
type Dashboard = { counts: Record<string, number>; recentOpportunities: Opportunity[]; pendingApplications: Application[]; recentTasks: Task[]; upcomingTasks: Task[]; recentReports: Report[] };
export function ResearchDashboard({ me, navigate }: { me: Me; navigate: (tab: 'research-opportunities' | 'research-applications' | 'research-tasks' | 'progress-reports') => void }) {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { let alive = true; setError(''); setData(undefined);
    api<Dashboard>('dashboards').then(r => { if (alive) setData(r.data); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [revision, me.id]);
  if (error) return <ErrorState message={error} retry={() => setRevision(x => x + 1)} />;
  if (!data) return <Skeleton />;
  const student = me.subsystemRole === 'guest', admin = me.subsystemRole === 'admin';
  const metrics = student ? [['applications', 'ใบสมัครของฉัน'], ['pendingApplications', 'รอพิจารณา'], ['assistants', 'โครงการที่เป็นผู้ช่วย'], ['tasks', 'งานของฉัน'], ['completedTasks', 'งานเสร็จสิ้น'], ['evaluations', 'ผลประเมิน']] :
    admin ? [['opportunities', 'โครงการทั้งหมด'], ['applications', 'ใบสมัครทั้งหมด'], ['pendingApplications', 'ใบสมัครรอพิจารณา'], ['assistants', 'ผู้ช่วยทั้งหมด'], ['tasks', 'งานทั้งหมด'], ['completedTasks', 'งานเสร็จสิ้น']] : [['opportunities', 'โครงการของฉัน'], ['pendingApplications', 'ใบสมัครรอพิจารณา'], ['assistants', 'ผู้ช่วยวิจัย'], ['inProgressTasks', 'งานกำลังดำเนินการ'], ['completedTasks', 'งานเสร็จสิ้น'], ['reports', 'รายงานความคืบหน้า']];
  return <div className="space-y-8">
    <section className="rounded-xl bg-primary-container/10 p-6 text-body-md"><p className="text-label-md text-primary-container">{student ? 'พื้นที่ทำงานของนักศึกษา' : admin ? 'ศูนย์จัดการระบบ' : 'พื้นที่วิจัยของอาจารย์'}</p>
      <h2 className="font-display text-headline-md">ภาพรวมการทำงาน</h2><p>{student ? 'ติดตามใบสมัคร งาน และผลการประเมินของคุณ' : admin ? 'ติดตามและจัดการข้อมูลทุกโครงการ' : 'ติดตามและจัดการโครงการที่คุณรับผิดชอบ'}</p>
    </section>
    <div className="grid gap-6 md:grid-cols-3">{metrics.map(([key, label]) => <article className={`${cardClass} flex flex-col gap-3 p-6`} key={key}><span className="text-label-md text-on-surface-variant">{label}</span><strong className="font-display text-display-lg tabular-nums text-primary-container">{data.counts[key] ?? 0}</strong></article>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={`${cardClass} space-y-4 p-6`}><h2 className="font-display text-headline-md">โครงการล่าสุด</h2>{data.recentOpportunities.length ? data.recentOpportunities.map(o => <div className="border-t border-outline-variant/40 pt-3" key={o.id}><strong>{o.researchTitle}</strong><p className="text-body-md text-on-surface-variant"><Badge value={o.status} /> · ปิดรับ {formatDate(o.applicationDeadline)}</p></div>) : <p>ยังไม่มีโครงการ</p>}<Button onClick={() => navigate('research-opportunities')}>ดูประกาศทั้งหมด</Button></section>
      <section className={`${cardClass} space-y-4 p-6`}><h2 className="font-display text-headline-md">{student ? 'ใบสมัครของฉันที่รอพิจารณา' : 'ใบสมัครรอพิจารณาล่าสุด'}</h2>{data.pendingApplications.length ? data.pendingApplications.map(a => <div className="border-t border-outline-variant/40 pt-3" key={a.id}><strong>{a.opportunity?.researchTitle}</strong><p className="text-body-md text-on-surface-variant">{a.coreUserId} · {formatDate(a.createdAt)}</p></div>) : <p>ไม่มีใบสมัครรอพิจารณา</p>}<Button onClick={() => navigate('research-applications')}>ดูใบสมัครทั้งหมด</Button></section>
      <section className={`${cardClass} space-y-4 p-6`}><h2 className="font-display text-headline-md">งานที่ต้องติดตาม</h2>{data.upcomingTasks.length ? data.upcomingTasks.map(t => <div className="border-t border-outline-variant/40 pt-3" key={t.id}><strong>{t.taskTitle}</strong><p className="text-body-md text-on-surface-variant"><Badge value={t.status} /> · {formatDate(t.dueDate)}</p></div>) : <p>ไม่มีงานค้าง</p>}<Button onClick={() => navigate('research-tasks')}>ดูงานทั้งหมด</Button></section>
      <section className={`${cardClass} space-y-4 p-6`}><h2 className="font-display text-headline-md">ความคืบหน้าล่าสุด</h2>{data.recentReports.length ? data.recentReports.map(r => <div className="border-t border-outline-variant/40 pt-3" key={r.id}><strong>{r.task?.taskTitle}</strong><p className="text-body-md text-on-surface-variant">{r.progressPercentage}% · {formatDate(r.createdAt)}</p></div>) : <p>ยังไม่มีรายงาน</p>}<Button onClick={() => navigate('progress-reports')}>ดูรายงานทั้งหมด</Button></section>
    </div>
    <div className="flex flex-wrap gap-3"><Button variant="primary" onClick={() => navigate('research-opportunities')}>ค้นหางานวิจัย</Button><Button onClick={() => navigate('research-applications')}>ตรวจสอบใบสมัคร</Button></div>
  </div>;
}
