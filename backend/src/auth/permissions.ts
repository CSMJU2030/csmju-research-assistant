import { SubsystemRole } from './core-hub-identity';

export enum Permission {
  READ = 'research:read',
  APPLY = 'research-application:create:own',
  MANAGE_OWN = 'research:manage:own',
  MANAGE_ANY = 'research:manage:any',
  REPORT = 'progress-report:create:own',
}

export const ROLE_PERMISSIONS: Readonly<Record<SubsystemRole, readonly Permission[]>> = Object.freeze({
  [SubsystemRole.STUDENT]: [Permission.READ, Permission.APPLY, Permission.REPORT],
  [SubsystemRole.STAFF]: [Permission.READ, Permission.MANAGE_OWN],
  [SubsystemRole.ADMIN]: [Permission.READ, Permission.MANAGE_ANY],
  [SubsystemRole.ALUMNI]: [],
});
export function can(role: SubsystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
export function canAny(role: SubsystemRole, permissions: readonly Permission[]): boolean {
  return permissions.some(permission => can(role, permission));
}
