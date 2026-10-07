"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, setFormDirty, signIn } from "../lib/api";
import { Button, labels, researchInputClass } from "./research-ui";

export type Field = {
  name: string;
  label: string;
  type?: "textarea" | "number" | "datetime-local" | "select" | "skills";
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
};
const choices = (...values: string[]) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));
export const opportunityFields: Field[] = [
  { name: "researchTitle", label: "ชื่อหัวข้องานวิจัย", required: true },
  {
    name: "description",
    label: "รายละเอียดงานวิจัย",
    type: "textarea",
    required: true,
  },
  {
    name: "responsibilities",
    label: "หน้าที่ผู้ช่วยวิจัย",
    type: "textarea",
    required: true,
  },
  {
    name: "positions",
    label: "จำนวนที่รับ",
    type: "number",
    min: 1,
    max: 1000,
    required: true,
  },
  {
    name: "requiredSkills",
    label: "ทักษะที่ต้องการ (คั่นด้วยจุลภาค)",
    type: "skills",
    required: true,
  },
  {
    name: "startDate",
    label: "วันและเวลาเริ่มงาน",
    type: "datetime-local",
    required: true,
  },
  {
    name: "endDate",
    label: "วันและเวลาสิ้นสุดงาน",
    type: "datetime-local",
    required: true,
  },
  {
    name: "applicationDeadline",
    label: "วันและเวลาปิดรับสมัคร",
    type: "datetime-local",
    required: true,
  },
  { name: "faculty", label: "คณะ", type: "select", required: true },
  {
    name: "status",
    label: "สถานะประกาศ",
    type: "select",
    options: choices("draft", "open", "closed"),
    required: true,
  },
];
export const applicationFields: Field[] = [
  {
    name: "reason",
    label: "เหตุผลในการสมัคร",
    type: "textarea",
    required: true,
  },
  { name: "skills", label: "ทักษะของคุณ (คั่นด้วยจุลภาค)", type: "skills" },
  { name: "experience", label: "ประสบการณ์", type: "textarea" },
];
export const taskFields: Field[] = [
  {
    name: "researchAssistantId",
    label: "ผู้รับผิดชอบ",
    type: "select",
    required: true,
  },
  { name: "taskTitle", label: "ชื่องาน", required: true },
  {
    name: "description",
    label: "รายละเอียดงาน",
    type: "textarea",
    required: true,
  },
  {
    name: "dueDate",
    label: "วันและเวลากำหนดส่ง",
    type: "datetime-local",
    required: true,
  },
  {
    name: "priority",
    label: "ระดับความสำคัญ",
    type: "select",
    options: choices("low", "medium", "high"),
    required: true,
  },
];
export const taskStatusField: Field = {
  name: "status",
  label: "สถานะงาน",
  type: "select",
  options: choices("in_progress", "completed"),
  required: true,
};
export const reportFields: Field[] = [
  {
    name: "progressPercentage",
    label: "ความคืบหน้า (%)",
    type: "number",
    min: 0,
    max: 100,
    required: true,
  },
  {
    name: "progressDetail",
    label: "รายละเอียดความคืบหน้า",
    type: "textarea",
    required: true,
  },
  { name: "problems", label: "ปัญหาที่พบ", type: "textarea" },
  { name: "nextAction", label: "สิ่งที่จะดำเนินการต่อ", type: "textarea" },
];
export const evaluationFields: Field[] = [
  {
    name: "researchAssistantId",
    label: "ผู้ช่วยวิจัย",
    type: "select",
    required: true,
  },
  ...[
    ["responsibilityScore", "ความรับผิดชอบ"],
    ["qualityScore", "คุณภาพงาน"],
    ["punctualityScore", "การตรงต่อเวลา"],
    ["teamworkScore", "การทำงานเป็นทีม"],
  ].map(([name, label]): Field => ({
    name,
    label: `${label} (1–5)`,
    type: "number",
    min: 1,
    max: 5,
    required: true,
  })),
  { name: "comment", label: "ความคิดเห็นเพิ่มเติม", type: "textarea" },
];

function localDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function ResearchForm({
  fields,
  initial = {},
  submit,
  cancel,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  submit: (body: Record<string, unknown>) => Promise<void>;
  cancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invalid, setInvalid] = useState<string>();
  useEffect(() => () => setFormDirty(false), []);
  const form = useRef<HTMLFormElement>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setInvalid(undefined);
    const values = new FormData(event.currentTarget),
      body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = String(values.get(field.name) ?? "").trim();
      if (!value && !field.required && field.type !== "skills") {
        body[field.name] = "";
        continue;
      }
      body[field.name] =
        field.type === "number"
          ? Number(value)
          : field.type === "datetime-local"
            ? new Date(value).toISOString()
            : field.type === "skills"
              ? value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : value;
    }
    try {
      await submit(body);
      setFormDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถบันทึกได้");
      if (e instanceof ApiError && e.field) {
        setInvalid(e.field);
        const element = form.current?.elements.namedItem(e.field);
        if (element instanceof HTMLElement) element.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form ref={form} onChange={() => setFormDirty(true)} onSubmit={save} className="max-h-[65vh] space-y-4 overflow-y-auto text-body-md">
      {error && (
        <p role="alert" className="rounded-lg bg-error-container p-3 text-on-error-container" id="form-error">
          {error}
          {error.includes("เข้าสู่ระบบ") && <Button type="button" onClick={() => { if (window.confirm("เข้าสู่ระบบใหม่และยกเลิกข้อมูลที่ยังไม่บันทึก?")) signIn(); }}>เข้าสู่ระบบอีกครั้ง</Button>}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        {fields.map((field) => {
          const value = initial[field.name];
          const defaultValue = Array.isArray(value)
            ? value.join(", ")
            : field.type === "datetime-local" && typeof value === "string"
              ? localDate(value)
              : String(value ?? "");
          const props = {
            id: `field-${field.name}`,
            name: field.name,
            required: field.required,
            defaultValue,
            "aria-invalid": invalid === field.name,
            "aria-describedby": [
              invalid === field.name ? "form-error" : undefined,
              field.type === "number" &&
              (field.min !== undefined || field.max !== undefined)
                ? `field-${field.name}-constraints`
                : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          };
          return (
            <div className="space-y-2" key={field.name}>
              <label className="block text-label-md" htmlFor={props.id}>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea {...props} className={researchInputClass} rows={4} maxLength={10000} />
              ) : field.type === "select" ? (
                <select {...props} className={researchInputClass}>
                  <option value="">เลือก{field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    {...props}
                    className={researchInputClass}
                    type={
                      field.type === "skills" ? "text" : (field.type ?? "text")
                    }
                    min={field.min}
                    max={field.max}
                    step={field.type === "number" ? 1 : undefined}
                    maxLength={field.type === "skills" ? 5000 : 240}
                  />
                  {field.type === "number" &&
                    (field.min !== undefined || field.max !== undefined) && (
                      <p
                        id={`field-${field.name}-constraints`}
                        className="text-body-sm text-on-surface-variant"
                      >
                        {field.min !== undefined && field.max !== undefined
                          ? `กรอกได้ตั้งแต่ ${field.min} ถึง ${field.max}`
                          : field.min !== undefined
                            ? `ค่าต่ำสุด ${field.min}`
                            : `ค่าสูงสุด ${field.max}`}
                      </p>
                    )}
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" disabled={busy} onClick={cancel}>
          ยกเลิก
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
