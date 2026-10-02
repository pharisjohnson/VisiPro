import type { Doc } from '../../convex/_generated/dataModel';
import { EmployeeStatus, Role, VisitorStatus } from '../types';
import type { Announcement, Appointment, CustomField, Employee, Member, Notification, Visitor } from '../types';

const ROLES: Record<Doc<'members'>['role'], Role> = {
    admin: Role.ADMIN,
    guard: Role.GUARD,
    host: Role.HOST,
};
export const ROLE_TO_DB: Record<Role, Doc<'members'>['role']> = {
    [Role.ADMIN]: 'admin',
    [Role.GUARD]: 'guard',
    [Role.HOST]: 'host',
};

export const toMember = (m: Doc<'members'>): Member => ({
    id: m._id,
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: ROLES[m.role],
    photoUrl: m.photoUrl,
    phone: m.phone,
});

export const toVisitor = (v: Doc<'visitors'>): Visitor => ({
    id: v._id,
    name: v.name,
    company: v.company,
    host: v.hostName,
    hostUserId: v.hostUserId,
    purpose: v.purpose,
    checkInTime: new Date(v.checkInTime),
    checkOutTime: v.checkOutTime ? new Date(v.checkOutTime) : undefined,
    status: v.status === 'in' ? VisitorStatus.CHECKED_IN : VisitorStatus.CHECKED_OUT,
    source: v.source,
    autoCheckedOut: v.autoCheckedOut,
    extraData: v.extraData,
});

export const toAppointment = (a: Doc<'appointments'>): Appointment => ({
    id: a._id,
    visitorName: a.visitorName,
    visitorCompany: a.visitorCompany,
    host: a.hostName,
    hostUserId: a.hostUserId,
    scheduledTime: new Date(a.scheduledTime),
    checkInCode: a.checkInCode,
    visitorPhone: a.visitorPhone,
    status: a.status,
});

export const toEmployee = (e: Doc<'employees'>): Employee => ({
    id: e._id,
    name: e.name,
    checkInTime: new Date(e.checkInTime),
    checkOutTime: e.checkOutTime ? new Date(e.checkOutTime) : undefined,
    status: e.status === 'in' ? EmployeeStatus.CHECKED_IN : EmployeeStatus.CHECKED_OUT,
    autoCheckedOut: e.autoCheckedOut,
    extraData: e.extraData,
});

export const toCustomField = (f: Doc<'customFields'>): CustomField => ({
    id: f._id,
    label: f.label,
    key: f.key,
    target: f.target,
    required: f.required,
});

export const toAnnouncement = (a: Doc<'announcements'>): Announcement => ({
    id: a._id,
    title: a.title,
    content: a.content,
    authorName: a.authorName,
    authorRole: ROLES[a.authorRole],
    timestamp: new Date(a._creationTime),
});

export const toNotification = (n: Doc<'notifications'>): Notification => ({
    id: n._id,
    message: n.message,
    timestamp: new Date(n._creationTime),
    read: n.read,
});
