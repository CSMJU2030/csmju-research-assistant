"use client";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Modal, PageHeader, cardClass } from "@/csmju";
import {
  all,
  api,
  type Me,
  type Row,
  type Opportunity,
  type Assistant,
  type Task,
  type Faculty,
  type Meta,
} from "../lib/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  formatDate,
  labels,
  researchInputClass,
} from "./research-ui";
import {
  ResearchForm,
  opportunityFields,
  applicationFields,
  taskFields,
  taskStatusField,
  reportFields,
  evaluationFields,
  type Field,
} from "./research-form";

import { ResearchDashboard } from "./research-dashboard";
const tabs = [
  { key: "dashboard", title: "ภาพรวม" },
  { key: "research-opportunities", title: "ประกาศงานวิจัย" },
  { key: "research-applications", title: "ใบสมัคร" },
  { key: "research-assistants", title: "ผู้ช่วยวิจัย" },
  { key: "research-tasks", title: "งานที่มอบหมาย" },
  { key: "progress-reports", title: "รายงานความคืบหน้า" },
  { key: "research-evaluations", title: "ผลการประเมิน" },
] as const;
type Tab = (typeof tabs)[number]["key"];
type Editor = {
  title: string;
  fields: Field[];
  initial?: Record<string, unknown>;
  path: string;
  method: string;
  extra?: Record<string, unknown>;
};
const title = (row: Row): string =>
  "researchTitle" in row
    ? row.researchTitle
    : "taskTitle" in row
      ? row.taskTitle
      : "opportunity" in row
        ? (row.opportunity?.researchTitle ?? "งานวิจัย")
        : "assistant" in row
          ? (row.assistant?.opportunity?.researchTitle ?? "งานวิจัย")
          : "task" in row
            ? (row.task?.taskTitle ?? "รายงานความคืบหน้า")
            : "รายการ";
const asRecord = (row: Row) => row as unknown as Record<string, unknown>;
const detailLabels: Record<string, string> = {
  researchTitle: "หัวข้องานวิจัย",
  description: "รายละเอียด",
  responsibilities: "หน้าที่ผู้ช่วย",
  positions: "จำนวนที่รับ",
  requiredSkills: "ทักษะที่ต้องการ",
  startDate: "วันเริ่มงาน",
  endDate: "วันสิ้นสุดงาน",
  applicationDeadline: "ปิดรับสมัคร",
  faculty: "คณะ",
  coreUserId: "ผู้ใช้ Core Hub",
  reason: "เหตุผลในการสมัคร",
  skills: "ทักษะ",
  experience: "ประสบการณ์",
  taskTitle: "ชื่องาน",
  dueDate: "กำหนดส่ง",
  priority: "ความสำคัญ",
  status: "สถานะ",
  progressPercentage: "ความคืบหน้า (%)",
  progressDetail: "รายละเอียดความคืบหน้า",
  problems: "ปัญหาที่พบ",
  nextAction: "สิ่งที่จะทำต่อ",
  responsibilityScore: "ความรับผิดชอบ",
  qualityScore: "คุณภาพงาน",
  punctualityScore: "การตรงต่อเวลา",
  teamworkScore: "การทำงานเป็นทีม",
  comment: "ความคิดเห็น",
  createdAt: "วันที่สร้าง",
  updatedAt: "แก้ไขล่าสุด",
};

export default function ResearchApp() {
  const router = useRouter();
  const pathname = usePathname();
  const section = pathname.slice(1);
  const tab: Tab = tabs.some(t => t.key === section) ? section as Tab : "dashboard";
  const [me, setMe] = useState<Me>();
  const [rows, setRows] = useState<Row[]>([]),
    [meta, setMeta] = useState<Meta>(),
    [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState({
    search: "",
    skill: "",
    faculty: "",
    status: "",
    own: "",
  });
  const [faculties, setFaculties] = useState<Faculty[]>([]),
    [facultyError, setFacultyError] = useState("");
  const [editor, setEditor] = useState<Editor>(),
    [detail, setDetail] = useState<Row>(),
    [deleting, setDeleting] = useState<Opportunity>();
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const manage =
    me?.subsystemRole === "editor" || me?.subsystemRole === "admin";
  const owns = (row: Opportunity) =>
    me?.subsystemRole === "admin" || (manage && row.coreUserId === me?.id);
  const heading = tabs.find((item) => item.key === tab)!.title;

  useEffect(() => {
    let active = true;
    api<Me>("me")
      .then((r) => {
        if (active) setMe(r.data);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const loadFaculties = useCallback(() => {
    setFacultyError("");
    return all<Faculty>("faculties")
      .then((r) => {
        setFaculties(r);
        return r;
      })
      .catch((e) => {
        setFacultyError(e.message);
        throw e;
      });
  }, []);
  useEffect(() => {
    if (me) void loadFaculties().catch(() => undefined);
  }, [me, loadFaculties]);
  useEffect(() => {
    if (!me || tab === "dashboard") { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRows([]);
    const query = new URLSearchParams({ page: String(page), limit: "12" });
    for (const [key, value] of Object.entries(filter))
      if (value) query.set(key, value);
    api<Row[]>(`${tab}?${query}`, "GET", undefined, controller.signal)
      .then((r) => {
        setRows(r.data);
        setMeta(r.meta);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [me, tab, page, filter, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const refresh = () => {
    setRevision((x) => x + 1);
  };
  function switchTab(value: Tab) {
    router.push(value === "dashboard" ? "/" : `/${value}`);
    setPage(1);
    setFilter({ search: "", skill: "", faculty: "", status: "", own: "" });
    setActionError("");
  }
  async function mutate(path: string, method: string, body?: unknown) {
    await api(path, method, body);
    setNotice("บันทึกข้อมูลสำเร็จ");
    setEditor(undefined);
    setDetail(undefined);
    setDeleting(undefined);
    refresh();
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function opportunityEditor(row?: Opportunity) {
    await action(async () => {
      const available = faculties.length ? faculties : await loadFaculties();
      if (!available.length) throw new Error('Core Hub ยังไม่มีคณะที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลข้อมูลกลาง');
      const options = available.map((f) => ({
        value: f.code,
        label: f.nameTh || f.code,
      }));
      if (row && !options.some((f) => f.value === row.faculty))
        options.push({
          value: row.faculty,
          label: `${row.faculty} (ข้อมูลเดิม)`,
        });
      setEditor({
        title: row ? "แก้ไขประกาศ" : "สร้างประกาศงานวิจัย",
        fields: opportunityFields.map((f) =>
          f.name === "faculty" ? { ...f, options } : f,
        ),
        initial: row ? asRecord(row) : { status: "draft", positions: 1 },
        path: `research-opportunities${row ? "/" + row.id : ""}`,
        method: row ? "PATCH" : "POST",
      });
    });
  }
  async function taskEditor(row?: Task) {
    await action(async () => {
      if (!manage && row) {
        setEditor({
          title: "อัปเดตสถานะงาน",
          fields: [taskStatusField],
          initial: {
            status: row.status === "todo" ? "in_progress" : row.status,
          },
          path: `research-tasks/${row.id}`,
          method: "PATCH",
        });
        return;
      }
      const assistants = await all<Assistant>("research-assistants");
      const options = assistants
        .filter(
          (a) =>
            !row ||
            a.researchOpportunityId === row.assistant?.researchOpportunityId,
        )
        .map((a) => ({
          value: a.id,
          label: `${a.opportunity?.researchTitle} · ${a.coreUserId}`,
        }));
      if (!options.length)
        throw new Error(
          "ยังไม่มีผู้ช่วยที่ได้รับอนุมัติ กรุณาคัดเลือกผู้สมัครก่อน",
        );
      const fields = taskFields.map((f) =>
        f.name === "researchAssistantId" ? { ...f, options } : f,
      );
      if (row)
        fields.push({
          ...taskStatusField,
          options: ["todo", "in_progress", "completed"].map((value) => ({
            value,
            label: labels[value],
          })),
        });
      setEditor({
        title: row ? "แก้ไขงาน" : "มอบหมายงาน",
        fields,
        initial: row ? asRecord(row) : { priority: "medium" },
        path: `research-tasks${row ? "/" + row.id : ""}`,
        method: row ? "PATCH" : "POST",
      });
    });
  }
  async function evaluationEditor() {
    await action(async () => {
      const assistants = await all<Assistant>("research-assistants");
      if (!assistants.length) throw new Error("ยังไม่มีผู้ช่วยวิจัยให้ประเมิน");
      setEditor({
        title: "ประเมินผู้ช่วยวิจัย",
        fields: evaluationFields.map((f) =>
          f.name === "researchAssistantId"
            ? {
                ...f,
                options: assistants.map((a) => ({
                  value: a.id,
                  label: `${a.opportunity?.researchTitle} · ${a.coreUserId}`,
                })),
              }
            : f,
        ),
        path: "research-evaluations",
        method: "POST",
      });
    });
  }
  function rowActions(row: Row, inDetail = false) {
    if ("researchTitle" in row) {
      const full = (row._count?.assistants ?? 0) >= row.positions;
      const expired = new Date(row.applicationDeadline) <= new Date();
      return (
        <>
          {owns(row) && (
            <>
              <Button disabled={busy} onClick={() => opportunityEditor(row)}>
                แก้ไข
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDetail(undefined);
                  setDeleting(row);
                }}
              >
                ลบ
              </Button>
            </>
          )}
          {me?.subsystemRole === "guest" && (
            <>
              <Button
                disabled={full || expired || row.status !== "open"}
                onClick={() =>
                  setEditor({
                    title: `สมัคร: ${row.researchTitle}`,
                    fields: applicationFields,
                    path: "research-applications",
                    method: "POST",
                    extra: { researchOpportunityId: row.id },
                  })
                }
              >
                สมัคร
              </Button>
              {(full || expired || row.status !== "open") && (
                <small>
                  {full
                    ? "จำนวนรับเต็มแล้ว"
                    : expired
                      ? "หมดเขตรับสมัคร"
                      : "ยังไม่เปิดรับสมัคร"}
                </small>
              )}
            </>
          )}
        </>
      );
    }
    if ("reason" in row && row.status === "pending")
      return manage ? (
        inDetail ? (
          <>
            <Button
              disabled={busy}
              variant="primary"
              onClick={() =>
                action(() =>
                  mutate(`research-applications/${row.id}`, "PATCH", {
                    status: "approved",
                  }),
                )
              }
            >
              อนุมัติ
            </Button>
            <Button
              disabled={busy}
              variant="danger"
              onClick={() =>
                action(() =>
                  mutate(`research-applications/${row.id}`, "PATCH", {
                    status: "rejected",
                  }),
                )
              }
            >
              ปฏิเสธ
            </Button>
          </>
        ) : (
          <Button onClick={() => setDetail(row)}>ตรวจใบสมัคร</Button>
        )
      ) : (
        <Button
          disabled={busy}
          onClick={() =>
            action(() =>
              mutate(`research-applications/${row.id}`, "PATCH", {
                status: "cancelled",
              }),
            )
          }
        >
          ยกเลิกใบสมัคร
        </Button>
      );
    if ("researchApplicationId" in row && manage)
      return (
        <Button
          onClick={() =>
            setEditor({
              title: "กำหนดหน้าที่ผู้ช่วย",
              fields: [
                {
                  name: "responsibilities",
                  label: "หน้าที่ที่ได้รับมอบหมาย",
                  type: "textarea",
                  required: true,
                },
              ],
              initial: asRecord(row),
              path: `research-assistants/${row.id}`,
              method: "PATCH",
            })
          }
        >
          แก้ไขหน้าที่
        </Button>
      );
    if ("taskTitle" in row) {
      const latestProgress = row.reports?.[0]?.progressPercentage ?? 0;
      return (
        <>
          <Button
            disabled={busy || (!manage && row.status === "completed")}
            onClick={() => taskEditor(row)}
          >
            {manage ? "แก้ไขงาน" : "อัปเดตสถานะ"}
          </Button>
          {!manage && row.status !== "completed" && (
            <Button
              onClick={() =>
                setEditor({
                  title: `รายงาน: ${row.taskTitle}`,
                  fields: reportFields.map((field) =>
                    field.name === "progressPercentage"
                      ? {
                          ...field,
                          min: latestProgress,
                          label: `ความคืบหน้า (%) — ขั้นต่ำ ${latestProgress}%`,
                        }
                      : field,
                  ),
                  initial: { progressPercentage: latestProgress },
                  path: "progress-reports",
                  method: "POST",
                  extra: { researchTaskId: row.id },
                })
              }
            >
              ส่งรายงาน
            </Button>
          )}
          {!manage && row.status === "completed" && (
            <small>งานเสร็จสิ้นแล้ว</small>
          )}
        </>
      );
    }
    return null;
  }

  return (
    <div className="space-y-8" aria-labelledby="page-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader title={heading} description="ระบบจัดการผู้ช่วยวิจัย" />
          {manage &&
            (tab === "research-opportunities" ||
              tab === "research-tasks" ||
              tab === "research-evaluations") && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  tab === "research-opportunities"
                    ? opportunityEditor()
                    : tab === "research-tasks"
                      ? taskEditor()
                      : evaluationEditor()
                }
              >
                <Plus size={18} aria-hidden="true" />
                {tab === "research-opportunities"
                  ? "สร้างประกาศ"
                  : tab === "research-tasks"
                    ? "มอบหมายงาน"
                    : "ประเมินผู้ช่วย"}
              </Button>
            )}
        </div>
        {notice && (
          <div role="status" className="rounded-lg bg-success/10 p-4 text-body-md text-emerald-700">
            {notice}
          </div>
        )}
        {error.includes('เข้าสู่ระบบ') && <a className="text-primary-container underline" href="/auth/login">เข้าสู่ระบบอีกครั้ง</a>}
        {actionError && (
          <div role="alert" className="rounded-lg bg-error-container p-4 text-body-md text-on-error-container">
            {actionError}
          </div>
        )}
        {tab === "research-opportunities" && (
          <>
            <form
              className={`${cardClass} flex flex-wrap items-end gap-4 p-6`}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setPage(1);
                setFilter({
                  search: String(data.get("search") ?? ""),
                  skill: String(data.get("skill") ?? ""),
                  faculty: String(data.get("faculty") ?? ""),
                  status: String(data.get("status") ?? ""),
                  own: String(data.get("own") ?? ""),
                });
              }}
            >
              <div className="min-w-48 flex-1 space-y-2">
                <label htmlFor="search">ค้นหาหัวข้องานวิจัย</label>
                <input
                  id="search"
                  name="search"
                  type="search"
                  className={researchInputClass}
                  placeholder="ชื่อหัวข้องานวิจัย"
                />
              </div>
              <div className="min-w-48 flex-1 space-y-2">
                <label htmlFor="skill">ทักษะที่ต้องการ</label>
                <input id="skill" name="skill" className={researchInputClass} placeholder="เช่น Python" />
              </div>
              <div className="min-w-40 flex-1 space-y-2">
                <label htmlFor="faculty">คณะ</label>
                <select id="faculty" name="faculty" className={researchInputClass}>
                  <option value="">ทุกคณะ</option>
                  {faculties.map((f) => (
                    <option value={f.code} key={f.code}>
                      {f.nameTh}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-40 flex-1 space-y-2">
                <label htmlFor="status">สถานะ</label>
                <select id="status" name="status" className={researchInputClass}>
                  <option value="">ทุกสถานะ</option>
                  {["open", "closed", ...(manage ? ["draft"] : [])].map((s) => (
                    <option value={s} key={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </div>
              {manage && (
                <label className="flex min-h-11 items-center gap-2 text-label-md">
                  <input type="checkbox" name="own" value="true" />
                  ประกาศของฉัน
                </label>
              )}
              <Button type="submit">
                <Search size={18} aria-hidden="true" />
                ค้นหา
              </Button>
              <Button
                type="reset"
                onClick={() => {
                  setPage(1);
                  setFilter({
                    search: "",
                    skill: "",
                    faculty: "",
                    status: "",
                    own: "",
                  });
                }}
              >
                ล้างตัวกรอง
              </Button>
            </form>
            {facultyError && (
              <div className="rounded-lg bg-amber-100 p-4 text-body-md text-amber-800" role="status">
                โหลดรายชื่อคณะจาก Core Hub ไม่สำเร็จ: {facultyError}{" "}
                <Button
                  onClick={() => void loadFaculties().catch(() => undefined)}
                >
                  ลองอีกครั้ง
                </Button>
              </div>
            )}
          </>
        )}
        {tab === "dashboard" && me ? <ResearchDashboard me={me} navigate={switchTab} /> : loading ? (
          <Skeleton />
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : !rows.length ? (
          <EmptyState filtered={Object.values(filter).some(Boolean)} />
        ) : (
          <>
            <div className="text-label-md text-on-surface-variant">
              ทั้งหมด {meta?.total ?? rows.length} รายการ
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {rows.map((row) => (
                <article className={`${cardClass} space-y-4 p-6`} key={row.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <h2>
                      <button
                        className="text-left font-display text-headline-md text-primary-container hover:underline focus-visible:outline-2 focus-visible:outline-primary-container"
                        onClick={() => {
                          setActionError("");
                          setDetail(row);
                        }}
                      >
                        {title(row)}
                      </button>
                    </h2>
                    {"status" in row && <Badge value={row.status} />}
                  </div>
                  {"researchTitle" in row && (
                    <>
                      <p className="text-body-md text-on-surface-variant">{row.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {row.requiredSkills.map((skill) => (
                          <span className="rounded-full bg-primary-container/10 px-3 py-1 text-label-md text-primary-container" key={skill}>
                            {skill}
                          </span>
                        ))}
                      </div>
                      <p className="text-body-md text-on-surface-variant">
                        รับ {row.positions} คน · อนุมัติแล้ว{" "}
                        {row._count?.assistants ?? 0} คน ·{" "}
                        {faculties.find((f) => f.code === row.faculty)
                          ?.nameTh ?? row.faculty}
                      </p>
                      <p className="text-body-md text-on-surface-variant">
                        ปิดรับสมัคร {formatDate(row.applicationDeadline)}
                      </p>
                    </>
                  )}
                  {"reason" in row && (
                    <>
                      <p className="text-body-md text-on-surface-variant">ผู้สมัคร: {row.coreUserId}</p>
                      <p className="text-body-md">{row.reason}</p>
                    </>
                  )}
                  {"researchApplicationId" in row && (
                    <>
                      <p className="text-body-md text-on-surface-variant">ผู้ช่วย: {row.coreUserId}</p>
                      <p>{row.responsibilities}</p>
                    </>
                  )}
                  {"taskTitle" in row && (
                    <>
                      <p>{row.description}</p>
                      <p className="text-body-md text-on-surface-variant">
                        {row.assistant?.coreUserId} · กำหนดส่ง{" "}
                        {formatDate(row.dueDate)} · ความสำคัญ{" "}
                        <Badge value={row.priority} />
                      </p>
                      <label className="block space-y-2 text-label-md">
                        รายงานล่าสุด {row.reports?.[0]?.progressPercentage ?? 0}
                        %
                        <progress
                          max={100}
                          className="block w-full accent-primary-container"
                          value={row.reports?.[0]?.progressPercentage ?? 0}
                        />
                      </label>
                    </>
                  )}
                  {"progressDetail" in row && (
                    <>
                      <p>{row.progressDetail}</p>
                      <label className="block space-y-2 text-label-md">
                        ความคืบหน้า {row.progressPercentage}%
                        <progress className="block w-full accent-primary-container" max={100} value={row.progressPercentage} />
                      </label>
                      <p className="text-body-md text-on-surface-variant">{formatDate(row.createdAt)}</p>
                    </>
                  )}
                  {"qualityScore" in row && (
                    <>
                      <p className="text-body-md text-on-surface-variant">
                        ผู้ช่วย: {row.assistant?.coreUserId}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["ความรับผิดชอบ", row.responsibilityScore],
                          ["คุณภาพงาน", row.qualityScore],
                          ["ตรงต่อเวลา", row.punctualityScore],
                          ["ทำงานเป็นทีม", row.teamworkScore],
                        ].map(([label, score]) => (
                          <div className="flex justify-between gap-3 rounded-lg bg-surface-container p-3 text-label-md" key={label}>
                            <span>{label}</span>
                            <strong>{score} / 5</strong>
                          </div>
                        ))}
                      </div>
                      {row.comment && <p>{row.comment}</p>}
                    </>
                  )}
                  <div className="flex flex-wrap gap-3 border-t border-outline-variant/40 pt-4">
                    <Button
                      onClick={() => {
                        setActionError("");
                        setDetail(row);
                      }}
                    >
                      ดูรายละเอียด
                    </Button>
                    {rowActions(row)}
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                aria-label="หน้าก่อนหน้า"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={18} />
              </Button>
              <span>
                หน้า {page} / {meta?.totalPages ?? 1}
              </span>
              <Button
                aria-label="หน้าถัดไป"
                disabled={page >= (meta?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </>
        )}
      {editor && (
        <Modal title={editor.title} onClose={() => setEditor(undefined)}>
          <ResearchForm
            fields={editor.fields}
            initial={editor.initial}
            cancel={() => setEditor(undefined)}
            submit={(body) =>
              mutate(editor.path, editor.method, { ...body, ...editor.extra })
            }
          />
        </Modal>
      )}
      {detail && !editor && (
        <Modal
          title={title(detail)}
          onClose={() => {
            setDetail(undefined);
            setActionError("");
          }}
        >
          {error.includes('เข้าสู่ระบบ') && <a className="text-primary-container underline" href="/auth/login">เข้าสู่ระบบอีกครั้ง</a>}
        {actionError && (
            <p className="rounded-lg bg-error-container p-4 text-on-error-container" role="alert">
              {actionError}
            </p>
          )}
          <dl className="max-h-[60vh] space-y-3 overflow-y-auto text-body-md">
            {Object.entries(asRecord(detail))
              .filter(([key]) => detailLabels[key])
              .map(([key, value]) => (
                <div className="border-b border-outline-variant/40 pb-2" key={key}>
                  <dt className="text-label-md text-on-surface-variant">{detailLabels[key]}</dt>
                  <dd className="break-words">
                    {Array.isArray(value)
                      ? value.join(", ")
                      : value == null || value === ""
                        ? "ไม่ระบุ"
                        : /Date$|At$|Deadline$/.test(key)
                          ? formatDate(String(value))
                          : (labels[String(value)] ?? String(value))}
                  </dd>
                </div>
              ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">{rowActions(detail, true)}</div>
        </Modal>
      )}
      {deleting && (
        <Modal title="ยืนยันการลบประกาศ" onClose={() => setDeleting(undefined)}>
          <p>
            ต้องการลบ “{deleting.researchTitle}” หรือไม่?
            ไม่สามารถกู้คืนรายการที่ลบได้
          </p>
          {error.includes('เข้าสู่ระบบ') && <a className="text-primary-container underline" href="/auth/login">เข้าสู่ระบบอีกครั้ง</a>}
        {actionError && (
            <p role="alert" className="rounded-lg bg-error-container p-4 text-on-error-container">
              {actionError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button disabled={busy} onClick={() => setDeleting(undefined)}>
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                action(() =>
                  mutate(`research-opportunities/${deleting.id}`, "DELETE"),
                )
              }
            >
              ลบ
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
