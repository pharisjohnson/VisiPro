export enum VisitorStatus {
  CHECKED_IN = 'Checked In',
  CHECKED_OUT = 'Checked Out',
}

export enum EmployeeStatus {
  CHECKED_IN = 'Checked In',
  CHECKED_OUT = 'Checked Out',
}

export enum Role {
  ADMIN = 'Admin',
  GUARD = 'Guard',
  HOST = 'Host',
}

export type View = 'dashboard' | 'checkin' | 'employees' | 'schedule' | 'log' | 'ai' | 'admin' | 'profile';

// UI-facing shapes. Convex documents (epoch-ms numbers, `_id`) are converted
// to these by lib/mappers.ts so components don't depend on the storage format.

export interface Member {
  id: string; // Convex member document id
  userId: string; // Clerk user id
  name: string;
  email: string;
  role: Role;
  photoUrl?: string;
  phone?: string;
}
export type User = Member;

export interface Visitor {
  id: string;
  name: string;
  company: string;
  host: string;
  hostUserId?: string;
  purpose: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: VisitorStatus;
  source?: 'staff' | 'kiosk';
  autoCheckedOut?: boolean;
  extraData: Record<string, string>;
}

export interface Appointment {
  id: string;
  visitorName: string;
  visitorCompany: string;
  host: string;
  hostUserId?: string;
  scheduledTime: Date;
  checkInCode: string;
  visitorPhone?: string;
  status: 'scheduled' | 'arrived' | 'cancelled';
}

export interface Employee {
  id: string;
  name: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: EmployeeStatus;
  autoCheckedOut?: boolean;
  extraData: Record<string, string>;
}

export interface CustomField {
  id: string;
  label: string;
  key: string;
  target: 'visitor' | 'employee';
  required: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: Role;
  timestamp: Date;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
}
