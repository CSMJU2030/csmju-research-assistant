import { SubsystemRole } from './core-hub-identity';
import { Permission, can } from './permissions';
describe('Research permissions', () => {
  it('students cannot manage research', () => {
    expect(can(SubsystemRole.STUDENT,Permission.MANAGE_OWN)).toBe(false);
    expect(can(SubsystemRole.STUDENT,Permission.MANAGE_ANY)).toBe(false);
    expect(can(SubsystemRole.STUDENT,Permission.APPLY)).toBe(true);
  });
  it('staff cannot override ownership or apply', () => {
    expect(can(SubsystemRole.STAFF,Permission.MANAGE_ANY)).toBe(false);
    expect(can(SubsystemRole.STAFF,Permission.MANAGE_OWN)).toBe(true);
    expect(can(SubsystemRole.STAFF,Permission.APPLY)).toBe(false);
  });
  it('admin manages any research but does not impersonate a student', () => {
    expect(can(SubsystemRole.ADMIN,Permission.MANAGE_ANY)).toBe(true);
    expect(can(SubsystemRole.ADMIN,Permission.REPORT)).toBe(false);
  });
});
