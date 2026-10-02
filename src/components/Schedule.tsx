import React, { useState } from 'react';
import type { Appointment, Member, User } from '../types';
import { Role } from '../types';
import { localInputToMs } from '../lib/utils';
import { useToast } from './Toast';

interface AppointmentConfirmationModalProps {
    appointment: Appointment;
    onClose: () => void;
}
export const AppointmentConfirmationModal: React.FC<AppointmentConfirmationModalProps> = ({ appointment, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-lg text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-600 mb-4">Appointment Scheduled!</h2>
            <p className="text-gray-600 mb-6">Give your visitor this code. They show it at the gate to check in{appointment.visitorPhone ? ", and we'll text it to them too (if SMS is on)" : ''}.</p>

            <div className="bg-gray-50 p-6 rounded-lg mb-6 text-left space-y-2">
                <p><strong className="w-28 inline-block">Visitor:</strong> {appointment.visitorName}</p>
                <p><strong className="w-28 inline-block">Company:</strong> {appointment.visitorCompany || '—'}</p>
                <p><strong className="w-28 inline-block">Host:</strong> {appointment.host}</p>
                <p><strong className="w-28 inline-block">Time:</strong> {appointment.scheduledTime.toLocaleString()}</p>
                {appointment.visitorPhone && <p><strong className="w-28 inline-block">Phone:</strong> {appointment.visitorPhone}</p>}
            </div>

            <div className="text-center">
                <p className="text-lg font-semibold text-gray-700 mb-2">Check-In Code</p>
                <p className="text-4xl font-bold text-indigo-600 tracking-widest bg-gray-100 p-3 rounded-md">{appointment.checkInCode}</p>
            </div>

            <button onClick={onClose} className="mt-8 w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Close
            </button>
        </div>
    </div>
);

export interface NewAppointment {
    visitorName: string;
    visitorCompany: string;
    hostName: string;
    hostUserId?: string;
    scheduledTime: number;
    visitorPhone?: string;
}
interface AppointmentSchedulerProps {
    addAppointment: (appointment: NewAppointment) => Promise<boolean>;
    currentUser: User;
    members: Member[];
}
export const AppointmentScheduler: React.FC<AppointmentSchedulerProps> = ({ addAppointment, currentUser, members }) => {
    const toast = useToast();
    const isHost = currentUser.role === Role.HOST;
    const [visitorName, setVisitorName] = useState('');
    const [visitorCompany, setVisitorCompany] = useState('');
    const [host, setHost] = useState(isHost ? currentUser.name : '');
    const [scheduledTime, setScheduledTime] = useState('');
    const [visitorPhone, setVisitorPhone] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitorName.trim() || !host.trim() || !scheduledTime) {
            toast.error('Please fill out all required fields.');
            return;
        }
        const match = members.find(m => m.name.toLowerCase() === host.trim().toLowerCase());
        setSaving(true);
        const ok = await addAppointment({
            visitorName,
            visitorCompany,
            hostName: host,
            hostUserId: isHost ? currentUser.userId : match?.userId,
            scheduledTime: localInputToMs(scheduledTime),
            visitorPhone: visitorPhone.trim() || undefined,
        });
        setSaving(false);
        if (ok) {
            setVisitorName('');
            setVisitorCompany('');
            if (!isHost) setHost('');
            setScheduledTime('');
            setVisitorPhone('');
        }
    };

    const field = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Schedule an Appointment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="visitorName" className="block text-sm font-medium text-gray-700">Visitor's Name *</label>
                    <input type="text" id="visitorName" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required className={field} />
                </div>
                <div>
                    <label htmlFor="visitorCompany" className="block text-sm font-medium text-gray-700">Visitor's Company</label>
                    <input type="text" id="visitorCompany" value={visitorCompany} onChange={(e) => setVisitorCompany(e.target.value)} className={field} />
                </div>
                <div>
                    <label htmlFor="visitorPhone" className="block text-sm font-medium text-gray-700">Visitor's mobile <span className="text-gray-400 font-normal">(optional, we'll text them the code)</span></label>
                    <input type="tel" id="visitorPhone" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="0712 345 678" className={field} />
                </div>
                <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700">Host / Employee *</label>
                    <input type="text" id="host" list="host-options" value={host} onChange={(e) => setHost(e.target.value)} required disabled={isHost} className={`${field} disabled:bg-gray-100 disabled:text-gray-500`} />
                    <datalist id="host-options">
                        {members.map(m => <option key={m.id} value={m.name} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700">Date and Time *</label>
                    <input type="datetime-local" id="scheduledTime" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required className={field} />
                </div>
                <button type="submit" disabled={saving} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                    {saving ? 'Scheduling…' : 'Schedule Appointment'}
                </button>
            </form>
        </div>
    );
};
