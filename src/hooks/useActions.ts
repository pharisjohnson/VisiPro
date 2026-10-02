import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/errors';
import { ROLE_TO_DB } from '../lib/mappers';
import type { Role } from '../types';
import type { NewVisitor } from '../components/CheckIn';
import type { NewAppointment } from '../components/Schedule';
import type { Appointment } from '../types';

/**
 * Wraps every Convex mutation so failures surface as toasts (server errors
 * carry readable messages) and callers get a boolean to decide whether to
 * reset their form.
 */
export function useActions() {
    const toast = useToast();
    const checkInVisitor = useMutation(api.visitors.checkIn);
    const checkOutVisitor = useMutation(api.visitors.checkOut);
    const createAppointment = useMutation(api.appointments.create);
    const checkInEmployee = useMutation(api.employees.checkIn);
    const checkOutEmployee = useMutation(api.employees.checkOut);
    const addCustomField = useMutation(api.customFields.add);
    const removeCustomField = useMutation(api.customFields.remove);
    const postAnnouncement = useMutation(api.announcements.post);
    const setMemberRole = useMutation(api.members.setRole);
    const markNotificationRead = useMutation(api.notifications.markRead);
    const setMemberPhone = useMutation(api.members.setPhone);

    const run = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
        try {
            await fn();
            if (success) toast.success(success);
            return true;
        } catch (error) {
            toast.error(errorMessage(error));
            return false;
        }
    };

    return {
        addVisitor: (v: NewVisitor) =>
            run(() => checkInVisitor({ ...v, appointmentId: v.appointmentId as Id<'appointments'> | undefined }), `${v.name} has been checked in.`),
        checkOutVisitor: (id: string) => run(() => checkOutVisitor({ id: id as Id<'visitors'> }), 'Visitor checked out.'),
        addEmployee: (e: { name: string; extraData: Record<string, string> }) =>
            run(() => checkInEmployee(e), `${e.name} has been checked in.`),
        checkOutEmployee: (id: string) => run(() => checkOutEmployee({ id: id as Id<'employees'> }), 'Employee checked out.'),
        addCustomField: (f: { label: string; target: 'visitor' | 'employee'; required: boolean }) => run(() => addCustomField(f), 'Field added.'),
        removeCustomField: (id: string) => run(() => removeCustomField({ id: id as Id<'customFields'> })),
        addAnnouncement: (a: { title: string; content: string }) => run(() => postAnnouncement(a), 'Announcement posted.'),
        setRole: (memberId: string, role: Role) => run(() => setMemberRole({ memberId: memberId as Id<'members'>, role: ROLE_TO_DB[role] }), 'Role updated.'),
        setPhone: (memberId: string, phone: string) => run(() => setMemberPhone({ memberId: memberId as Id<'members'>, phone }), phone.trim() ? 'Phone number saved.' : 'Phone number removed.'),
        markNotificationRead: (id: string) => run(() => markNotificationRead({ id: id as Id<'notifications'> })),
        /** Resolves to the created appointment (for the confirmation modal), or null on failure. */
        addAppointment: async (a: NewAppointment): Promise<Appointment | null> => {
            try {
                const created = await createAppointment(a);
                return {
                    id: created.id,
                    visitorName: a.visitorName.trim(),
                    visitorCompany: a.visitorCompany.trim(),
                    host: created.hostName,
                    hostUserId: a.hostUserId,
                    visitorPhone: a.visitorPhone,
                    scheduledTime: new Date(a.scheduledTime),
                    checkInCode: created.checkInCode,
                    status: 'scheduled',
                };
            } catch (error) {
                toast.error(errorMessage(error));
                return null;
            }
        },
    };
}
