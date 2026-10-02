import React, { useState, useMemo, useEffect } from 'react';
import type { Visitor, Appointment, Employee, CustomField, User, Announcement, Notification, Member } from '../types';
import { VisitorStatus, EmployeeStatus, Role } from '../types';
import * as Icons from './icons';
const { HomeIcon, UserPlusIcon, BriefcaseIcon, CalendarPlusIcon, ListIcon, SparklesIcon, SettingsIcon, ChevronDownIcon, ChevronUpIcon, MegaphoneIcon, BarChartIcon, BellIcon } = Icons;
import { exportToCsv, copyToClipboard } from '../lib/utils';
import { useToast } from './Toast';

// --- CHECK-IN / CHECK-OUT / LOGS ---

export type SortKey<T> = keyof T;
export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
    key: SortKey<T>;
    direction: SortDirection;
}

export const useSortableData = <T extends object>(items: T[], config: SortConfig<T> | null = null) => {
    const [sortConfig, setSortConfig] = useState(config);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key: SortKey<T>) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};

export const SortableHeader= <T,>({ label, name, sortConfig, requestSort }: { label: string, name: keyof T, sortConfig: SortConfig<T> | null, requestSort: (name: keyof T) => void }) => {
    const isSorted = sortConfig?.key === name;
    return (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <button onClick={() => requestSort(name)} className="flex items-center space-x-1">
                <span>{label}</span>
                {isSorted ? (sortConfig?.direction === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />) : null}
            </button>
        </th>
    );
};

export interface LogControlsProps {
    onSearch: (term: string) => void;
    onCopy: () => void;
    onExportCsv: () => void;
    onExportJson: () => void;
    currentUser: User;
}
export const LogControls: React.FC<LogControlsProps> = ({ onSearch, onCopy, onExportCsv, onExportJson, currentUser }) => (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <input
            type="text"
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search log..."
            className="w-full md:w-1/3 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        {currentUser.role === Role.ADMIN && (
            <div className="flex space-x-2">
                <button onClick={onCopy} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Copy</button>
                <button onClick={onExportCsv} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Export CSV</button>
                <button onClick={onExportJson} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Export JSON</button>
            </div>
        )}
    </div>
);

export interface VisitorLogProps {
    visitors: Visitor[];
    checkOutVisitor: (id: string) => void;
    customFields: CustomField[];
}
export const VisitorLog: React.FC<VisitorLogProps> = ({ visitors, checkOutVisitor, customFields }) => {
    const { items, requestSort, sortConfig } = useSortableData(visitors);
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <SortableHeader label="Name" name="name" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Company" name="company" sortConfig={sortConfig} requestSort={requestSort} />
                        {customFields.map(field => (
                             <th key={field.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</th>
                        ))}
                        <SortableHeader label="Host" name="host" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Check In" name="checkInTime" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Status" name="status" sortConfig={sortConfig} requestSort={requestSort} />
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {items.length > 0 ? items.map((visitor) => (
                        <tr key={visitor.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{visitor.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.company || '—'}</td>
                            {customFields.map(field => (
                                <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.extraData[field.key] || 'N/A'}</td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.host}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.checkInTime.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${visitor.status === VisitorStatus.CHECKED_IN ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {visitor.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {visitor.status === VisitorStatus.CHECKED_IN && (
                                    <button onClick={() => checkOutVisitor(visitor.id)} className="text-indigo-600 hover:text-indigo-900">Check Out</button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={6 + customFields.length} className="text-center py-8 text-gray-500">No matching visitors found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export interface EmployeeLogProps {
    employees: Employee[];
    checkOutEmployee: (id: string) => void;
    customFields: CustomField[];
}
export const EmployeeLog: React.FC<EmployeeLogProps> = ({ employees, checkOutEmployee, customFields }) => {
     const { items, requestSort, sortConfig } = useSortableData(employees);
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <SortableHeader label="Name" name="name" sortConfig={sortConfig} requestSort={requestSort} />
                        {customFields.map(field => (
                           <th key={field.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</th>
                        ))}
                        <SortableHeader label="Check In" name="checkInTime" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Status" name="status" sortConfig={sortConfig} requestSort={requestSort} />
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {items.length > 0 ? items.map((employee) => (
                        <tr key={employee.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.name}</td>
                             {customFields.map(field => (
                                <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.extraData[field.key] || 'N/A'}</td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.checkInTime.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${employee.status === EmployeeStatus.CHECKED_IN ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {employee.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {employee.status === EmployeeStatus.CHECKED_IN && (
                                    <button onClick={() => checkOutEmployee(employee.id)} className="text-teal-600 hover:text-teal-900">Check Out</button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={4 + customFields.length} className="text-center py-8 text-gray-500">No matching employees found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export const AppointmentLog: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-In Code</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {appointments.length > 0 ? appointments.map((appt) => (
                    <tr key={appt.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{appt.visitorName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{appt.visitorCompany}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{appt.host}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{appt.scheduledTime.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{appt.checkInCode}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{appt.status}</td>
                    </tr>
                )) : (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No appointments scheduled.</td></tr>
                )}
            </tbody>
        </table>
    </div>
);


export interface LogsPageProps {
    visitors: Visitor[];
    employees: Employee[];
    appointments: Appointment[];
    checkOutVisitor: (id: string) => void;
    checkOutEmployee: (id: string) => void;
    visitorCustomFields: CustomField[];
    employeeCustomFields: CustomField[];
    currentUser: User;
}
export const LogsPage: React.FC<LogsPageProps> = (props) => {
    const toast = useToast();
    const isHost = props.currentUser.role === Role.HOST;
    const [activeTab, setActiveTab] = useState<'visitors' | 'employees' | 'appointments'>(isHost ? 'appointments' : 'visitors');
    const [visitorSearch, setVisitorSearch] = useState('');
    const [employeeSearch, setEmployeeSearch] = useState('');

    const filteredVisitors = useMemo(() => 
        props.visitors.filter(v => 
            Object.values(v).some(val => 
                String(val).toLowerCase().includes(visitorSearch.toLowerCase())
            )
        ), [props.visitors, visitorSearch]
    );

    const filteredEmployees = useMemo(() =>
        props.employees.filter(e =>
            Object.values(e).some(val =>
                String(val).toLowerCase().includes(employeeSearch.toLowerCase())
            )
        ), [props.employees, employeeSearch]
    );

    // Hosts only ever receive their own appointments from the server.
    const filteredAppointments = props.appointments;

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                 <div className="flex space-x-1">
                    {!isHost && (
                        <>
                            <button onClick={() => setActiveTab('visitors')} className={`px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'visitors' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>Visitor Log</button>
                            <button onClick={() => setActiveTab('employees')} className={`px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'employees' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}>Employee Log</button>
                        </>
                    )}
                    <button onClick={() => setActiveTab('appointments')} className={`px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'appointments' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>Appointments</button>
                </div>
            </div>
           
            {activeTab === 'visitors' && !isHost && (
                <>
                    <LogControls 
                        currentUser={props.currentUser}
                        onSearch={setVisitorSearch}
                        onCopy={() => copyToClipboard(filteredVisitors).then(() => toast.success('Log copied to clipboard'))}
                        onExportCsv={() => exportToCsv('visitor_log.csv', filteredVisitors)}
                        onExportJson={() => {
                            const blob = new Blob([JSON.stringify(filteredVisitors, null, 2)], { type: 'application/json' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = 'visitor_log.json';
                            link.click();
                        }}
                    />
                    <VisitorLog visitors={filteredVisitors} checkOutVisitor={props.checkOutVisitor} customFields={props.visitorCustomFields} />
                </>
            )} 
            {activeTab === 'employees' && !isHost && (
                <>
                    <LogControls 
                        currentUser={props.currentUser}
                        onSearch={setEmployeeSearch}
                        onCopy={() => copyToClipboard(filteredEmployees).then(() => toast.success('Log copied to clipboard'))}
                        onExportCsv={() => exportToCsv('employee_log.csv', filteredEmployees)}
                        onExportJson={() => {
                             const blob = new Blob([JSON.stringify(filteredEmployees, null, 2)], { type: 'application/json' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = 'employee_log.json';
                            link.click();
                        }}
                    />
                    <EmployeeLog employees={filteredEmployees} checkOutEmployee={props.checkOutEmployee} customFields={props.employeeCustomFields} />
                </>
            )}
            {activeTab === 'appointments' && <AppointmentLog appointments={filteredAppointments} />}
        </div>
    );
};
