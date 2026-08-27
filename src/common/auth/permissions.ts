import { PERMISSIONS, type Permission, type PermissionGroupDto, type RoleTier } from '../../contract/api';

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/** Grouped catalog the admin panel renders on the role editor. */
export const PERMISSION_GROUPS: PermissionGroupDto[] = [
  {
    key: 'catalog',
    label: 'Places',
    permissions: [
      { key: 'CATALOG_READ', label: 'View places', description: 'Attractions and partner businesses' },
      { key: 'CATALOG_WRITE', label: 'Edit places', description: 'Create, edit, publish and archive places' },
      { key: 'MEDIA_WRITE', label: 'Upload media', description: 'Photos and videos on any record' },
    ],
  },
  {
    key: 'routes',
    label: 'Routes',
    permissions: [
      { key: 'ROUTES_READ', label: 'View routes', description: 'Route list, nodes and map' },
      { key: 'ROUTES_WRITE', label: 'Edit routes', description: 'Compose and publish routes' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    permissions: [
      { key: 'FLEET_READ', label: 'View vehicles', description: 'Fleet and seat maps' },
      { key: 'FLEET_WRITE', label: 'Edit vehicles', description: 'Add vehicles, design seat maps' },
      { key: 'GUIDES_READ', label: 'View guides', description: 'Guide profiles' },
      { key: 'GUIDES_WRITE', label: 'Edit guides', description: 'Create and update guide profiles' },
      { key: 'TOURS_READ', label: 'View tours', description: 'Departures, passengers and seat status' },
      { key: 'TOURS_WRITE', label: 'Edit tours', description: 'Create, duplicate and edit departures and templates' },
      { key: 'TOURS_PUBLISH', label: 'Publish tours', description: 'Publish, cancel and complete departures' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    permissions: [
      { key: 'BOOKINGS_READ', label: 'View bookings', description: 'Every booking and ticket' },
      { key: 'BOOKINGS_WRITE', label: 'Manage bookings', description: 'Create manual bookings, edit passengers, cancel' },
      { key: 'BOOKINGS_CHECKIN', label: 'Check in passengers', description: 'Scan tickets at the meeting point' },
      { key: 'PAYMENTS_READ', label: 'View payments', description: 'Payment state and references' },
      { key: 'PAYMENTS_APPROVE', label: 'Approve payments', description: 'Confirm a booking once money arrived' },
      { key: 'PAYMENTS_REFUND', label: 'Refund payments', description: 'Record refunds' },
      { key: 'CUSTOMERS_READ', label: 'View customers', description: 'Customer directory and history' },
      { key: 'CUSTOMERS_WRITE', label: 'Edit customers', description: 'Notes and contact corrections' },
      { key: 'REPORTS_READ', label: 'View reports', description: 'Dashboard numbers and exports' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    permissions: [
      { key: 'ADMINS_READ', label: 'View admins', description: 'Who has access to this panel' },
      { key: 'ADMINS_WRITE', label: 'Manage admins', description: 'Invite, suspend and reassign roles' },
      { key: 'ROLES_READ', label: 'View roles', description: 'Role definitions' },
      { key: 'ROLES_WRITE', label: 'Manage roles', description: 'Create roles and change their permissions' },
      { key: 'SETTINGS_READ', label: 'View settings', description: 'Brand, contact and payment settings' },
      { key: 'SETTINGS_WRITE', label: 'Edit settings', description: 'Change brand, contact and payment settings' },
      { key: 'AUDIT_READ', label: 'View audit log', description: 'Who changed what, and when' },
    ],
  },
];

export interface SystemRoleSeed {
  key: string;
  name: string;
  description: string;
  tier: RoleTier;
  permissions: Permission[];
  isSystem: boolean;
}

const READ_EVERYTHING: Permission[] = ALL_PERMISSIONS.filter((p) => p.endsWith('_READ'));

/** Roles written by the seed. The first two are immutable; the rest are editable presets. */
export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'The single account that owns this panel. Cannot be removed or demoted.',
    tier: 'OWNER',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    key: 'full_access',
    name: 'Full Access',
    description: 'Every permission. Cannot remove or demote the owner or other full-access admins.',
    tier: 'FULL',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'Runs the calendar: tours, fleet, guides, bookings and payment approvals.',
    tier: 'STANDARD',
    permissions: [
      ...READ_EVERYTHING.filter((p) => !['ADMINS_READ', 'ROLES_READ', 'AUDIT_READ'].includes(p)),
      'FLEET_WRITE',
      'GUIDES_WRITE',
      'TOURS_WRITE',
      'TOURS_PUBLISH',
      'BOOKINGS_WRITE',
      'BOOKINGS_CHECKIN',
      'PAYMENTS_APPROVE',
      'CUSTOMERS_WRITE',
      'MEDIA_WRITE',
    ],
    isSystem: false,
  },
  {
    key: 'content_editor',
    name: 'Content Editor',
    description: 'Writes the places and routes customers read. No access to sales.',
    tier: 'STANDARD',
    permissions: ['CATALOG_READ', 'CATALOG_WRITE', 'ROUTES_READ', 'ROUTES_WRITE', 'MEDIA_WRITE', 'TOURS_READ'],
    isSystem: false,
  },
  {
    key: 'tour_guide',
    name: 'Tour Guide',
    description: 'Sees their own departures and passenger lists, checks people in.',
    tier: 'STANDARD',
    permissions: ['TOURS_READ', 'ROUTES_READ', 'CATALOG_READ', 'BOOKINGS_READ', 'BOOKINGS_CHECKIN', 'GUIDES_READ', 'FLEET_READ'],
    isSystem: false,
  },
  {
    key: 'finance',
    name: 'Finance',
    description: 'Approves and refunds payments, reads reports.',
    tier: 'STANDARD',
    permissions: ['BOOKINGS_READ', 'PAYMENTS_READ', 'PAYMENTS_APPROVE', 'PAYMENTS_REFUND', 'CUSTOMERS_READ', 'TOURS_READ', 'REPORTS_READ'],
    isSystem: false,
  },
  {
    key: 'support',
    name: 'Customer Support',
    description: 'Helps customers with bookings and tickets.',
    tier: 'STANDARD',
    permissions: ['CUSTOMERS_READ', 'CUSTOMERS_WRITE', 'BOOKINGS_READ', 'BOOKINGS_WRITE', 'TOURS_READ', 'ROUTES_READ', 'CATALOG_READ', 'PAYMENTS_READ'],
    isSystem: false,
  },
];

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (ALL_PERMISSIONS as readonly string[]).includes(value);
}
