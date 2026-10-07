import type { components } from './api-schema';
export type Schema = components['schemas'];
export type Me = Schema['Me'] & { session?: { expiresAt?: string } };
export type Opportunity = Schema['Opportunity'];
export type Application = Schema['Application'];
export type Assistant = Schema['Assistant'];
export type Task = Schema['Task'];
export type Report = Schema['Report'];
export type Evaluation = Schema['Evaluation'];
export type Faculty = Schema['Faculty'];
export type Meta = Schema['Meta'];
export type Row = Opportunity | Application | Assistant | Task | Report | Evaluation;
export type Envelope<T> = { success: true; data: T; meta?: Meta };
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}
const errors: Record<string,string> = {
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้', NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  BAD_REQUEST: 'ข้อมูลคำขอไม่ถูกต้อง', VALIDATION_ERROR: 'กรุณาตรวจสอบข้อมูลที่กรอก',
  SERVICE_UNAVAILABLE: 'ข้อมูลกลางจาก Core Hub ยังไม่พร้อม กรุณาลองใหม่ภายหลัง',
  TOO_MANY_REQUESTS: 'ทำรายการถี่เกินไป กรุณารอสักครู่',
  INTERNAL_ERROR: 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง', CONFLICT: 'ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่',
};
let formDirty = false;
let redirecting = false;
export function setFormDirty(value: boolean) { formDirty = value; }
export function signIn() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  window.location.assign('/auth/login?next=' + encodeURIComponent(next));
}
export async function api<T>(path: string, method = 'GET', data?: unknown, signal?: AbortSignal): Promise<Envelope<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, { method, credentials: 'same-origin', cache: 'no-store', signal,
      ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(503, 'INTERNAL_ERROR', 'เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง');
  }
  if (response.status === 401) {
    let last = 0;
    try { last = Number(sessionStorage.getItem('research.ssoAttempt') ?? 0); } catch { /* storage may be disabled */ }
    if (!redirecting && Date.now() - last >= 30000 && (!formDirty || window.confirm('การเข้าสู่ระบบหมดอายุ ข้อมูลที่ยังไม่บันทึกจะหาย ต้องการเข้าสู่ระบบใหม่หรือไม่?'))) {
      redirecting = true;
      try { sessionStorage.setItem('research.ssoAttempt', String(Date.now())); } catch { /* no storage */ }
      signIn();
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'การเข้าสู่ระบบหมดอายุ กรุณากดเข้าสู่ระบบอีกครั้ง');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const code = body?.error?.code ?? 'INTERNAL_ERROR';
    const message = body?.error?.message;
    throw new ApiError(response.status, code, typeof message === 'string' && /[ก-๙]/.test(message) ? message : errors[code] ?? errors.INTERNAL_ERROR, body?.error?.details?.field);
  }
  return body;
}
export async function all<T>(resource: string, query = ''): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await api<T[]>(`${resource}?limit=100&page=${page}${query ? '&' + query : ''}`);
    rows.push(...result.data);
    if (!result.meta || page >= result.meta.totalPages) return rows;
  }
}
