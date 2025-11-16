
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

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string; // Optional for display, required for creation
    role: Role;
    photoUrl: string;
    permissions: Partial<Record<View, boolean>>;
}

export interface Visitor {
  id: string;
  name: string;
  company: string;
  host: string;
  purpose: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: VisitorStatus;
  extraData: Record<string, any>;
}

export interface Appointment {
  id: string;
  visitorName: string;
  visitorCompany: string;
  host: string;
  scheduledTime: Date;
  checkInCode: string;
}

export interface Employee {
  id:string;
  name: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: EmployeeStatus;
  extraData: Record<string, any>;
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