import React, { useState, useMemo, useEffect } from 'react';
import type { Visitor, Appointment, Employee, CustomField, User, Announcement, Notification, Member } from '../types';
import { VisitorStatus, EmployeeStatus, Role } from '../types';
import * as Icons from './icons';
const { HomeIcon, UserPlusIcon, BriefcaseIcon, CalendarPlusIcon, ListIcon, SparklesIcon, SettingsIcon, ChevronDownIcon, ChevronUpIcon, MegaphoneIcon, BarChartIcon, BellIcon } = Icons;
import { exportToCsv, copyToClipboard } from '../lib/utils';
import { useToast } from './Toast';

export interface NewVisitor {
  name: string;
  company: string;
  hostName: string;
  hostUserId?: string;
  purpose: string;
  extraData: Record<string, string>;
  appointmentId?: string;
}
export interface AppointmentCheckInTerminalProps {
  addVisitor: (visitor: NewVisitor) => Promise<boolean>;
  customFields: CustomField[];
  appointments: Appointment[];
  members: Member[];
}
export const AppointmentCheckInTerminal: React.FC<AppointmentCheckInTerminalProps> = ({ addVisitor, customFields, appointments, members }) => {
    const toast = useToast();
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [host, setHost] = useState('');
    const [hostUserId, setHostUserId] = useState<string | undefined>();
    const [appointmentId, setAppointmentId] = useState<string | undefined>();
    const [purpose, setPurpose] = useState('Meeting');
    const [extraData, setExtraData] = useState<Record<string, string>>({});
    const [appointmentSearch, setAppointmentSearch] = useState('');
    const [saving, setSaving] = useState(false);

    const todaysAppointments = useMemo(() => appointments.filter(a => new Date(a.scheduledTime).toDateString() === new Date().toDateString()), [appointments]);
    const filteredAppointments = useMemo(() => {
        const searchTerm = appointmentSearch.trim().toLowerCase();
        if (searchTerm === '') return [];

        const codeMatch = todaysAppointments.find(a => a.checkInCode.toLowerCase() === searchTerm);
        if (codeMatch) return [codeMatch];

        return todaysAppointments.filter(a => a.visitorName.toLowerCase().includes(searchTerm));
    }, [todaysAppointments, appointmentSearch]);

    const handleSelectAppointment = (appt: Appointment) => {
        setName(appt.visitorName);
        setCompany(appt.visitorCompany);
        setHost(appt.host);
        setHostUserId(appt.hostUserId);
        setAppointmentId(appt.id);
        setAppointmentSearch('');
    };
    
    const handleExtraDataChange = (key: string, value: string) => {
        setExtraData(prev => ({ ...prev, [key]: value }));
    };

    const handleHostChange = (value: string) => {
        setHost(value);
        // Picking a known team member links the visit to them so they get notified.
        setHostUserId(members.find(m => m.name.toLowerCase() === value.trim().toLowerCase())?.userId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !host.trim()) {
            toast.error('Please fill out all required fields.');
            return;
        }
        setSaving(true);
        const ok = await addVisitor({ name, company, hostName: host, hostUserId, purpose, extraData, appointmentId });
        setSaving(false);
        if (ok) {
            setName('');
            setCompany('');
            setHost('');
            setHostUserId(undefined);
            setAppointmentId(undefined);
            setPurpose('Meeting');
            setExtraData({});
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Visitor Check-In</h2>
            <div className="mb-6">
                <label htmlFor="appointmentSearch" className="block text-sm font-medium text-gray-700">Appointment Lookup</label>
                 <div className="mt-1">
                    <input
                        type="text"
                        id="appointmentSearch"
                        value={appointmentSearch}
                        onChange={(e) => setAppointmentSearch(e.target.value)}
                        placeholder="Search by name or enter 6-digit code..."
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                </div>

                {filteredAppointments.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                        {filteredAppointments.map(appt => (
                            <button type="button" key={appt.id} onClick={() => handleSelectAppointment(appt)} className="w-full text-left p-3 hover:bg-gray-100 border-b last:border-b-0">
                                <p className="font-semibold">{appt.visitorName}</p>
                                <p className="text-sm text-gray-500">{appt.visitorCompany || 'No company'} - Meeting {appt.host}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <hr className="my-4"/>
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company</label>
                    <input type="text" id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700">Person to Visit *</label>
                    <input type="text" id="host" list="checkin-host-options" value={host} onChange={(e) => handleHostChange(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                    <datalist id="checkin-host-options">
                        {members.map(m => <option key={m.id} value={m.name} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">Purpose of Visit</label>
                    <select id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option>Meeting</option>
                        <option>Delivery</option>
                        <option>Interview</option>
                        <option>Tour</option>
                    </select>
                </div>
                {customFields.map(field => (
                    <div key={field.id}>
                        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700">{field.label} {field.required && '*'}</label>
                        <input type="text" id={field.key} value={extraData[field.key] || ''} onChange={(e) => handleExtraDataChange(field.key, e.target.value)} required={field.required} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                    </div>
                ))}
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 transition-colors" disabled={saving}>{saving ? 'Checking in…' : 'Check In Visitor'}</button>
            </form>
        </div>
    );
};

export interface CheckOutTerminalProps {
    visitors?: Visitor[];
    employees?: Employee[];
    checkOutVisitor?: (id: string) => void;
    checkOutEmployee?: (id: string) => void;
}
export const CheckOutTerminal: React.FC<CheckOutTerminalProps> = ({ visitors, employees, checkOutVisitor, checkOutEmployee }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredVisitors = useMemo(() => searchTerm.trim() === '' ? [] :
        (visitors ?? []).filter(v => v.status === VisitorStatus.CHECKED_IN && v.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [visitors, searchTerm]
    );

    const filteredEmployees = useMemo(() => searchTerm.trim() === '' ? [] :
        (employees ?? []).filter(e => e.status === EmployeeStatus.CHECKED_IN && e.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [employees, searchTerm]
    );

    const isVisitorMode = visitors !== undefined;
    const title = isVisitorMode ? "Visitor Check-Out" : "Employee Check-Out";

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{title}</h2>
            <div>
                <label htmlFor="checkoutSearch" className="block text-sm font-medium text-gray-700">Search by Name</label>
                <input
                    type="text"
                    id="checkoutSearch"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Start typing a name..."
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
            {(filteredVisitors.length > 0 || filteredEmployees.length > 0) && (
                <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                    {filteredVisitors.map(v => (
                        <div key={v.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                            <div>
                                <p className="font-semibold text-gray-800">{v.name}</p>
                                <p className="text-sm text-gray-600">from {v.company}</p>
                            </div>
                            <button onClick={() => { checkOutVisitor?.(v.id); setSearchTerm(''); }} className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors">Check Out</button>
                        </div>
                    ))}
                     {filteredEmployees.map(e => (
                        <div key={e.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                             <div>
                                <p className="font-semibold text-gray-800">{e.name}</p>
                            </div>
                            <button onClick={() => { checkOutEmployee?.(e.id); setSearchTerm(''); }} className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors">Check Out</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export interface EmployeeTerminalProps {
    addEmployee: (employee: { name: string; extraData: Record<string, string> }) => Promise<boolean>;
    checkOutEmployee: (id: string) => void;
    customFields: CustomField[];
    employees: Employee[];
}
export const EmployeeTerminal: React.FC<EmployeeTerminalProps> = ({ addEmployee, checkOutEmployee, customFields, employees }) => {
    const toast = useToast();
    const [name, setName] = useState('');
    const [extraData, setExtraData] = useState<Record<string, string>>({});

    const handleExtraDataChange = (key: string, value: string) => {
        setExtraData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Employee name is required.');
            return;
        }
        if (await addEmployee({ name, extraData })) {
            setName('');
            setExtraData({});
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Employee Check-In</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="employeeName" className="block text-sm font-medium text-gray-700">Full Name *</label>
                        <input type="text" id="employeeName" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    {customFields.map(field => (
                        <div key={field.id}>
                            <label htmlFor={field.key} className="block text-sm font-medium text-gray-700">{field.label} {field.required && '*'}</label>
                            <input type="text" id={field.key} value={extraData[field.key] || ''} onChange={(e) => handleExtraDataChange(field.key, e.target.value)} required={field.required} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    ))}
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors">Check In</button>
                </form>
            </div>
            <CheckOutTerminal employees={employees} checkOutEmployee={checkOutEmployee} />
        </div>
    );
};
