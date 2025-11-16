
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Visitor, Appointment, Employee, CustomField, User, Announcement, Notification, View } from './types';
import { VisitorStatus, EmployeeStatus, Role } from './types';
import { getAIAssistance } from './services/geminiService';

// --- ICONS (as JSX components) ---
const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
);
const BriefcaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
);
const CalendarPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>
);
const ListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
);
const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M18 13.5V21"/><path d="M21 18h-7.5"/></svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>;
const LogOutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const MegaphoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const BarChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>;
const BellIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;


// --- UTILITY & CONFIG ---
const ALL_VIEWS: View[] = ['dashboard', 'checkin', 'employees', 'schedule', 'log', 'ai', 'admin', 'profile'];
const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<View, boolean>>> = {
    [Role.ADMIN]: { dashboard: true, checkin: true, employees: true, schedule: true, log: true, ai: true, admin: true, profile: true },
    [Role.GUARD]: { dashboard: true, checkin: true, employees: true, schedule: true, log: true, profile: true },
    [Role.HOST]: { dashboard: true, schedule: true, log: true, profile: true },
};

const generateCheckInCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const exportToCsv = (filename: string, rows: object[]) => {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
        keys.join(separator) +
        '\n' +
        rows.map(row => {
            return keys.map(k => {
                let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
                cell = cell instanceof Date
                    ? cell.toLocaleString()
                    : cell.toString().replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(separator);
        }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

const copyToClipboard = (rows: object[]) => {
    if (!rows || !rows.length) return;
    const separator = '\t';
    const keys = Object.keys(rows[0]);
    const textContent =
        keys.join(separator) +
        '\n' +
        rows.map(row => {
            return keys.map(k => {
                const cell = (row as any)[k] ?? '';
                return cell instanceof Date ? cell.toLocaleString() : cell;
            }).join(separator);
        }).join('\n');
    navigator.clipboard.writeText(textContent).then(() => alert('Log copied to clipboard!'));
};


// --- HELPER COMPONENTS ---

interface DashboardCardProps {
  title: string;
  value: string | number;
  description: string;
}
const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, description }) => (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-3xl font-bold text-indigo-600 mt-2">{value}</p>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
);

interface AppointmentConfirmationModalProps {
    appointment: Appointment;
    onClose: () => void;
}
const AppointmentConfirmationModal: React.FC<AppointmentConfirmationModalProps> = ({ appointment, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-lg text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-600 mb-4">Appointment Scheduled!</h2>
            <p className="text-gray-600 mb-6">A unique check-in code has been generated for the visitor.</p>
            
            <div className="bg-gray-50 p-6 rounded-lg mb-6 text-left space-y-2">
                <p><strong className="w-28 inline-block">Visitor:</strong> {appointment.visitorName}</p>
                <p><strong className="w-28 inline-block">Company:</strong> {appointment.visitorCompany}</p>
                <p><strong className="w-28 inline-block">Host:</strong> {appointment.host}</p>
                <p><strong className="w-28 inline-block">Time:</strong> {appointment.scheduledTime.toLocaleString()}</p>
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

interface AppointmentSchedulerProps {
    addAppointment: (appointment: Omit<Appointment, 'id' | 'checkInCode'>) => void;
    currentUser: User;
}
const AppointmentScheduler: React.FC<AppointmentSchedulerProps> = ({ addAppointment, currentUser }) => {
    const [visitorName, setVisitorName] = useState('');
    const [visitorCompany, setVisitorCompany] = useState('');
    const [host, setHost] = useState(currentUser.role === Role.HOST ? currentUser.name : '');
    const [scheduledTime, setScheduledTime] = useState('');
    const isHost = currentUser.role === Role.HOST;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitorName || !host || !scheduledTime) {
            alert('Please fill out all required fields.');
            return;
        }
        addAppointment({ visitorName, visitorCompany, host, scheduledTime: new Date(scheduledTime) });
        setVisitorName('');
        setVisitorCompany('');
        if (!isHost) setHost('');
        setScheduledTime('');
    };
    
    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Schedule an Appointment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="visitorName" className="block text-sm font-medium text-gray-700">Visitor's Name *</label>
                    <input type="text" id="visitorName" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="visitorCompany" className="block text-sm font-medium text-gray-700">Visitor's Company</label>
                    <input type="text" id="visitorCompany" value={visitorCompany} onChange={(e) => setVisitorCompany(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700">Host / Employee *</label>
                    <input type="text" id="host" value={host} onChange={(e) => setHost(e.target.value)} required disabled={isHost} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500" />
                </div>
                <div>
                    <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700">Date and Time *</label>
                    <input type="datetime-local" id="scheduledTime" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Schedule Appointment</button>
            </form>
        </div>
    );
};

interface AIAssistantProps {
    visitors: Visitor[];
    appointments: Appointment[];
}
const AIAssistant: React.FC<AIAssistantProps> = ({ visitors, appointments }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleQuery = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setResponse('');
        const aiResponse = await getAIAssistance(query, visitors, appointments);
        setResponse(aiResponse);
        setIsLoading(false);
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">AI Assistant</h2>
            <p className="text-sm text-gray-500 mb-6">Ask about today's visitors, appointments, or get help with tasks.</p>
            
            <div className="flex-grow bg-gray-50 rounded-md p-4 overflow-y-auto mb-4 min-h-[200px]">
                {isLoading && <p className="text-gray-500 animate-pulse">Assistant is thinking...</p>}
                {response && <p className="text-gray-800 whitespace-pre-wrap">{response}</p>}
                {!isLoading && !response && <p className="text-gray-400">Ask a question like "Summarize today's meetings" or "How many visitors are currently on-site?"</p>}
            </div>

            <div className="flex space-x-2">
                <input 
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                    placeholder="Ask the AI assistant..."
                    className="flex-grow mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button onClick={handleQuery} disabled={isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                    {isLoading ? '...' : 'Ask'}
                </button>
            </div>
        </div>
    );
}

// --- ADMIN COMPONENTS ---
interface AdminUserManagementPanelProps {
    users: User[];
    addUser: (user: Omit<User, 'id'>) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;
}
const AdminUserManagementPanel: React.FC<AdminUserManagementPanelProps> = ({ users, addUser, updateUser, deleteUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const openAddModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };
    
    const handleSaveUser = (user: Omit<User, 'id'> | User) => {
        if ('id' in user) {
            updateUser(user);
        } else {
            addUser(user);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">User Management</h3>
                <button onClick={openAddModal} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Add User</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <img className="h-10 w-10 rounded-full object-cover" src={user.photoUrl} alt="" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openEditModal(user)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                    <button onClick={() => window.confirm('Are you sure?') && deleteUser(user.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <UserEditModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

interface UserEditModalProps {
    user: User | null;
    onSave: (user: Omit<User, 'id'> | User) => void;
    onClose: () => void;
}
const UserEditModal: React.FC<UserEditModalProps> = ({ user, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        role: user?.role || Role.HOST,
        photoUrl: user?.photoUrl || `https://i.pravatar.cc/150?u=${Date.now()}`,
        permissions: user?.permissions || DEFAULT_PERMISSIONS[user?.role || Role.HOST]
    });

    useEffect(() => {
        // Update permissions when role changes
        setFormData(prev => ({
            ...prev,
            permissions: DEFAULT_PERMISSIONS[prev.role]
        }));
    }, [formData.role]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePermissionChange = (view: View, isChecked: boolean) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [view]: isChecked
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            onSave({ ...user, ...formData });
        } else {
            if(!formData.password) {
                alert('Password is required for new users.');
                return;
            }
            onSave(formData);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-8 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">{user ? 'Edit User' : 'Add User'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required className="w-full px-3 py-2 border rounded"/>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" required className="w-full px-3 py-2 border rounded"/>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder={user ? 'New Password (optional)' : 'Password'} required={!user} className="w-full px-3 py-2 border rounded"/>
                    <select name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    
                    <div className="flex items-center space-x-4">
                        <img src={formData.photoUrl} alt="Profile preview" className="w-16 h-16 rounded-full object-cover bg-gray-200" />
                        <div className="flex-grow">
                            <label htmlFor="photoUploadModal" className="block text-sm font-medium text-gray-700">Upload new photo</label>
                            <input
                                type="file"
                                id="photoUploadModal"
                                name="photoUrl"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            setFormData({ ...formData, photoUrl: event.target.result as string });
                                        };
                                        reader.readAsDataURL(e.target.files[0]);
                                    }
                                }}
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-2 mt-4">Page Access Permissions</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {ALL_VIEWS.map(view => (
                                <label key={view} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={!!formData.permissions[view]}
                                        disabled={view === 'admin' && formData.role === Role.ADMIN}
                                        onChange={(e) => handlePermissionChange(view, e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm capitalize">{view}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface AnnouncementPosterProps {
    addAnnouncement: (announcement: Omit<Announcement, 'id'>) => void;
    currentUser: User;
}
const AnnouncementPoster: React.FC<AnnouncementPosterProps> = ({ addAnnouncement, currentUser }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('Please provide a title and content for the announcement.');
            return;
        }
        addAnnouncement({
            title,
            content,
            authorName: currentUser.name,
            authorRole: currentUser.role,
            timestamp: new Date(),
        });
        setTitle('');
        setContent('');
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <MegaphoneIcon /> <span className="ml-2">Post an Announcement</span>
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="announcementTitle" className="block text-sm font-medium text-gray-700">Title</label>
                    <input type="text" id="announcementTitle" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                    <label htmlFor="announcementContent" className="block text-sm font-medium text-gray-700">Content</label>
                    <textarea id="announcementContent" value={content} onChange={(e) => setContent(e.target.value)} required rows={4} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <button type="submit" className="w-full md:w-auto flex justify-center py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Post Announcement</button>
            </form>
        </div>
    );
};

interface AdminPanelProps {
    customFields: CustomField[];
    addCustomField: (field: Omit<CustomField, 'id' | 'key'>) => void;
    users: User[];
    addUser: (user: Omit<User, 'id'>) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;
    addAnnouncement: (announcement: Omit<Announcement, 'id'>) => void;
    currentUser: User;
}
const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const [label, setLabel] = useState('');
    const [target, setTarget] = useState<'visitor' | 'employee'>('visitor');
    const [required, setRequired] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!label) {
            alert('Please provide a field label.');
            return;
        }
        props.addCustomField({ label, target, required });
        setLabel('');
        setTarget('visitor');
        setRequired(false);
    };

    const visitorFields = props.customFields.filter(f => f.target === 'visitor');
    const employeeFields = props.customFields.filter(f => f.target === 'employee');

    return (
        <div className="space-y-8">
            <AnnouncementPoster addAnnouncement={props.addAnnouncement} currentUser={props.currentUser} />
            <AdminUserManagementPanel users={props.users} addUser={props.addUser} updateUser={props.updateUser} deleteUser={props.deleteUser} />
            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Custom Fields</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label htmlFor="fieldLabel" className="block text-sm font-medium text-gray-700">Field Label</label>
                        <input type="text" id="fieldLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., National ID" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label htmlFor="fieldTarget" className="block text-sm font-medium text-gray-700">Applies To</label>
                        <select id="fieldTarget" value={target} onChange={(e) => setTarget(e.target.value as any)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md">
                            <option value="visitor">Visitor</option>
                            <option value="employee">Employee</option>
                        </select>
                    </div>
                     <div className="flex items-center justify-start pt-6">
                        <input type="checkbox" id="fieldRequired" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor="fieldRequired" className="ml-2 block text-sm text-gray-900">Required</label>
                    </div>
                    <div className="md:col-span-4">
                        <button type="submit" className="w-full md:w-auto flex justify-center py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Add Field</button>
                    </div>
                </form>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Current Visitor Fields</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                        {visitorFields.length > 0 ? visitorFields.map(f => <li key={f.id}>{f.label} {f.required && <span className="text-xs text-gray-400">(Required)</span>}</li>) : <li>No visitor fields defined.</li>}
                    </ul>
                 </div>
                 <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Current Employee Fields</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                        {employeeFields.length > 0 ? employeeFields.map(f => <li key={f.id}>{f.label} {f.required && <span className="text-xs text-gray-400">(Required)</span>}</li>) : <li>No employee fields defined.</li>}
                    </ul>
                 </div>
            </div>
        </div>
    );
};

// --- CHECK-IN / CHECK-OUT / LOGS ---

type SortKey<T> = keyof T;
type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
    key: SortKey<T>;
    direction: SortDirection;
}

const useSortableData = <T extends object>(items: T[], config: SortConfig<T> | null = null) => {
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

const SortableHeader = <T,>({ label, name, sortConfig, requestSort }: { label: string, name: keyof T, sortConfig: SortConfig<T> | null, requestSort: (name: keyof T) => void }) => {
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

interface LogControlsProps {
    onSearch: (term: string) => void;
    onCopy: () => void;
    onExportCsv: () => void;
    onExportJson: () => void;
    currentUser: User;
}
const LogControls: React.FC<LogControlsProps> = ({ onSearch, onCopy, onExportCsv, onExportJson, currentUser }) => (
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

interface VisitorLogProps {
    visitors: Visitor[];
    checkOutVisitor: (id: string) => void;
    customFields: CustomField[];
}
const VisitorLog: React.FC<VisitorLogProps> = ({ visitors, checkOutVisitor, customFields }) => {
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitor.company}</td>
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

interface EmployeeLogProps {
    employees: Employee[];
    checkOutEmployee: (id: string) => void;
    customFields: CustomField[];
}
const EmployeeLog: React.FC<EmployeeLogProps> = ({ employees, checkOutEmployee, customFields }) => {
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

const AppointmentLog: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-In Code</th>
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
                    </tr>
                )) : (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No appointments scheduled.</td></tr>
                )}
            </tbody>
        </table>
    </div>
);


interface AppointmentCheckInTerminalProps {
  addVisitor: (visitor: Omit<Visitor, 'id' | 'checkInTime' | 'status'>) => void;
  customFields: CustomField[];
  appointments: Appointment[];
}
const AppointmentCheckInTerminal: React.FC<AppointmentCheckInTerminalProps> = ({ addVisitor, customFields, appointments }) => {
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [host, setHost] = useState('');
    const [purpose, setPurpose] = useState('Meeting');
    const [extraData, setExtraData] = useState<Record<string, any>>({});
    const [appointmentSearch, setAppointmentSearch] = useState('');

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
        setAppointmentSearch('');
    };
    
    const handleExtraDataChange = (key: string, value: string) => {
        setExtraData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !company || !host) {
            alert('Please fill out all required fields.');
            return;
        }
        addVisitor({ name, company, host, purpose, extraData });
        setName('');
        setCompany('');
        setHost('');
        setPurpose('Meeting');
        setExtraData({});
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
                            <button key={appt.id} onClick={() => handleSelectAppointment(appt)} className="w-full text-left p-3 hover:bg-gray-100 border-b last:border-b-0">
                                <p className="font-semibold">{appt.visitorName}</p>
                                <p className="text-sm text-gray-500">{appt.visitorCompany} - Meeting {appt.host}</p>
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
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company *</label>
                    <input type="text" id="company" value={company} onChange={(e) => setCompany(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700">Person to Visit *</label>
                    <input type="text" id="host" value={host} onChange={(e) => setHost(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
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
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Check In Visitor</button>
            </form>
        </div>
    );
};

interface CheckOutTerminalProps {
    visitors?: Visitor[];
    employees?: Employee[];
    checkOutVisitor: (id: string) => void;
    checkOutEmployee: (id: string) => void;
}
const CheckOutTerminal: React.FC<CheckOutTerminalProps> = ({ visitors = [], employees = [], checkOutVisitor, checkOutEmployee }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredVisitors = useMemo(() => searchTerm.trim() === '' ? [] :
        visitors.filter(v => v.status === VisitorStatus.CHECKED_IN && v.name.toLowerCase().includes(searchTerm.toLowerCase())), 
        [visitors, searchTerm]
    );

    const filteredEmployees = useMemo(() => searchTerm.trim() === '' ? [] :
        employees.filter(e => e.status === EmployeeStatus.CHECKED_IN && e.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [employees, searchTerm]
    );

    const isVisitorMode = visitors.length > 0;
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
                            <button onClick={() => { checkOutVisitor(v.id); setSearchTerm(''); }} className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors">Check Out</button>
                        </div>
                    ))}
                     {filteredEmployees.map(e => (
                        <div key={e.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                             <div>
                                <p className="font-semibold text-gray-800">{e.name}</p>
                            </div>
                            <button onClick={() => { checkOutEmployee(e.id); setSearchTerm(''); }} className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors">Check Out</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface EmployeeTerminalProps {
    addEmployee: (employee: Omit<Employee, 'id' | 'checkInTime' | 'status'>) => void;
    checkOutEmployee: (id: string) => void;
    customFields: CustomField[];
    employees: Employee[];
}
const EmployeeTerminal: React.FC<EmployeeTerminalProps> = ({ addEmployee, checkOutEmployee, customFields, employees }) => {
    const [name, setName] = useState('');
    const [extraData, setExtraData] = useState<Record<string, any>>({});
    
    const handleExtraDataChange = (key: string, value: string) => {
        setExtraData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Employee name is required.');
            return;
        }
        addEmployee({ name, extraData });
        setName('');
        setExtraData({});
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
            <CheckOutTerminal employees={employees} checkOutEmployee={checkOutEmployee} checkOutVisitor={()=>{}} />
        </div>
    );
};


interface LogsPageProps {
    visitors: Visitor[];
    employees: Employee[];
    appointments: Appointment[];
    checkOutVisitor: (id: string) => void;
    checkOutEmployee: (id: string) => void;
    visitorCustomFields: CustomField[];
    employeeCustomFields: CustomField[];
    currentUser: User;
}
const LogsPage: React.FC<LogsPageProps> = (props) => {
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

    const filteredAppointments = useMemo(() => 
        isHost
            ? props.appointments.filter(a => a.host === props.currentUser.name)
            : props.appointments,
        [props.appointments, props.currentUser, isHost]
    );

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
                        onCopy={() => copyToClipboard(filteredVisitors)}
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
                        onCopy={() => copyToClipboard(filteredEmployees)}
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

// --- AUTHENTICATION & PROFILE COMPONENTS ---
interface LoginScreenProps {
    onLogin: (email: string, pass: string) => void;
}
const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('admin@visitorapp.com');
    const [password, setPassword] = useState('admin123');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <svg className="h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.197-5.975M15 10a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-center text-gray-800">Welcome to VisitorApp</h2>
                <p className="text-center text-gray-500 mb-8">Sign in to continue</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <button type="submit" className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Sign In</button>
                </form>
            </div>
        </div>
    );
};

interface UserProfilePageProps {
    user: User;
    onUpdate: (updatedData: Partial<Pick<User, 'photoUrl' | 'password'>>) => void;
}
const UserProfilePage: React.FC<UserProfilePageProps> = ({ user, onUpdate }) => {
    const [photoUrl, setPhotoUrl] = useState(user.photoUrl);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const updates: Partial<Pick<User, 'photoUrl' | 'password'>> = {};

        if (photoUrl !== user.photoUrl) {
            updates.photoUrl = photoUrl;
        }

        if (newPassword) {
            if (newPassword !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }
            updates.password = newPassword;
        }
        
        if (Object.keys(updates).length > 0) {
            onUpdate(updates);
            setNewPassword('');
            setConfirmPassword('');
            alert('Profile updated successfully!');
        } else {
            alert('No changes were made.');
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-8">My Profile</h2>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex items-center space-x-6">
                    <img src={photoUrl || 'https://i.pravatar.cc/150'} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                    <div className="flex-grow">
                        <h3 className="text-xl font-semibold">{user.name}</h3>
                        <p className="text-gray-600">{user.email}</p>
                        <span className="mt-2 inline-block px-3 py-1 text-sm font-semibold text-blue-800 bg-blue-100 rounded-full">{user.role}</span>
                    </div>
                </div>

                <div>
                    <label htmlFor="photoUpload" className="block text-sm font-medium text-gray-700">Change Profile Photo</label>
                    <input
                        type="file"
                        id="photoUpload"
                        accept="image/*"
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    setPhotoUrl(event.target.result as string);
                                };
                                reader.readAsDataURL(e.target.files[0]);
                            }
                        }}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                </div>

                <hr />

                <h3 className="text-lg font-semibold text-gray-800 pt-2">Change Password</h3>
                 <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                    />
                </div>
                 <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                    />
                </div>
                
                <div className="pt-4">
                     <button type="submit" className="w-full md:w-auto flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- DASHBOARD & ANALYTICS ---
interface BarChartProps {
    data: { name: string; value: number }[];
    title: string;
}
const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 h-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><BarChartIcon /><span className="ml-2">{title}</span></h3>
            <div className="flex justify-around items-end h-64 space-x-2">
                {data.map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                        <div 
                            className="w-full bg-indigo-500 rounded-t-md hover:bg-indigo-600 transition-colors"
                            style={{ height: `${(d.value / maxValue) * 100}%` }}
                            title={`${d.name}: ${d.value} visitors`}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">{d.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface RecentActivityFeedProps {
    visitors: Visitor[];
    employees: Employee[];
}
const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ visitors, employees }) => {
    const recentActivity = useMemo(() => {
        const combined = [
            ...visitors.map(v => ({ type: 'Visitor', ...v })),
            ...employees.map(e => ({ type: 'Employee', ...e }))
        ];
        return combined.sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()).slice(0, 5);
    }, [visitors, employees]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Activity</h3>
            <div className="space-y-4">
                {recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${activity.type === 'Visitor' ? 'bg-indigo-100 text-indigo-600' : 'bg-teal-100 text-teal-600'}`}>
                            {activity.type === 'Visitor' ? <UserPlusIcon /> : <BriefcaseIcon />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-800">{activity.name} <span className="text-gray-500">checked in</span></p>
                            <p className="text-xs text-gray-400">{activity.checkInTime.toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AnnouncementBoard: React.FC<{ announcements: Announcement[] }> = ({ announcements }) => {
    if (announcements.length === 0) {
        return null; // Don't render if there are no announcements
    }
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
             <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><MegaphoneIcon /><span className="ml-2">Company Announcements</span></h2>
             <div className="space-y-4 max-h-72 overflow-y-auto">
                {announcements.map(ann => (
                    <div key={ann.id} className="p-4 bg-gray-50 rounded-md">
                        <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{ann.content}</p>
                        <p className="text-xs text-gray-400 mt-2">Posted by {ann.authorName} ({ann.authorRole}) on {ann.timestamp.toLocaleDateString()}</p>
                    </div>
                ))}
             </div>
        </div>
    );
};

interface AdminNotificationsProps {
    notifications: Notification[];
}
const AdminNotifications: React.FC<AdminNotificationsProps> = ({ notifications }) => {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (notifications.length === 0) return null;
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <BellIcon />
                <span className="ml-2">Notifications</span>
                {unreadCount > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">{unreadCount}</span>}
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
                {notifications.map(notif => (
                    <div key={notif.id} className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{notif.timestamp.toLocaleString()}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface HostDashboardProps {
    currentUser: User;
    visitors: Visitor[];
    checkOutVisitor: (id: string) => void;
}
const HostDashboard: React.FC<HostDashboardProps> = ({ currentUser, visitors, checkOutVisitor }) => {
    const myVisitors = visitors.filter(v => v.host === currentUser.name && v.status === VisitorStatus.CHECKED_IN);

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Visitors</h2>
            <p className="text-gray-600 mb-6">The following visitors are currently checked in to see you.</p>
            {myVisitors.length > 0 ? (
                <div className="space-y-4">
                    {myVisitors.map(visitor => (
                        <div key={visitor.id} className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <p className="font-semibold text-gray-900 text-lg">{visitor.name}</p>
                                <p className="text-sm text-gray-600">{visitor.company} - Arrived at {visitor.checkInTime.toLocaleTimeString()}</p>
                            </div>
                            <button
                                onClick={() => checkOutVisitor(visitor.id)}
                                className="mt-3 md:mt-0 w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                Confirm & Check Out
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-gray-500 py-8">You have no visitors currently checked in.</p>
            )}
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
    // --- STATE MANAGEMENT ---
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            return null;
        }
    });
    const [view, setView] = useState<View>('dashboard');
    const [newlyCreatedAppointment, setNewlyCreatedAppointment] = useState<Appointment | null>(null);
    
    const [users, setUsers] = useState<User[]>([
         { id: 'u1', name: 'Admin User', email: 'admin@visitorapp.com', password: 'admin123', role: Role.ADMIN, photoUrl: 'https://i.pravatar.cc/150?u=admin', permissions: DEFAULT_PERMISSIONS.Admin },
         { id: 'u2', name: 'Guard User', email: 'guard@visitorapp.com', password: 'guard123', role: Role.GUARD, photoUrl: 'https://i.pravatar.cc/150?u=guard', permissions: DEFAULT_PERMISSIONS.Guard },
         { id: 'u3', name: 'Host User', email: 'host@visitorapp.com', password: 'host123', role: Role.HOST, photoUrl: 'https://i.pravatar.cc/150?u=host', permissions: DEFAULT_PERMISSIONS.Host }
    ]);
    const [visitors, setVisitors] = useState<Visitor[]>([
        { id: '1', name: 'Alice Johnson', company: 'Innovate Corp', host: 'Host User', purpose: 'Sales Meeting', checkInTime: new Date(Date.now() - 3600000), status: VisitorStatus.CHECKED_IN, extraData: { vehicle_plate: 'KDA 123B'} },
        { id: '2', name: 'Charlie Davis', company: 'Tech Solutions', host: 'Carol White', purpose: 'Interview', checkInTime: new Date(Date.now() - 7200000), checkOutTime: new Date(Date.now() - 1800000), status: VisitorStatus.CHECKED_OUT, extraData: { vehicle_plate: 'KDB 456C'} },
    ]);
    const [appointments, setAppointments] = useState<Appointment[]>([
        { id: 'a1', visitorName: 'Frank Miller', visitorCompany: 'Global Exports', host: 'Diana Prince', scheduledTime: new Date(new Date().setHours(14, 0, 0)), checkInCode: 'FM39SL' },
        { id: 'a2', visitorName: 'Grace Lee', visitorCompany: 'Creative LLC', host: 'Host User', scheduledTime: new Date(new Date().setHours(16, 30, 0)), checkInCode: 'GL18CZ' },
    ]);
    const [employees, setEmployees] = useState<Employee[]>([
        { id: 'e1', name: 'John Doe', checkInTime: new Date(Date.now() - 5*3600000), status: EmployeeStatus.CHECKED_IN, extraData: { employee_id: 'EMP001', department: 'Engineering' }},
        { id: 'e2', name: 'Jane Smith', checkInTime: new Date(Date.now() - 6*3600000), checkOutTime: new Date(Date.now() - 30*60000), status: EmployeeStatus.CHECKED_OUT, extraData: { employee_id: 'EMP002', department: 'Marketing' }},
    ]);
    const [customFields, setCustomFields] = useState<CustomField[]>([
        { id: 'cf1', label: 'Vehicle Plate', key: 'vehicle_plate', target: 'visitor', required: false },
        { id: 'cf2', label: 'Employee ID', key: 'employee_id', target: 'employee', required: true },
        { id: 'cf3', label: 'Department', key: 'department', target: 'employee', required: true },
    ]);
     const [announcements, setAnnouncements] = useState<Announcement[]>([
        { id: 'an1', title: 'Scheduled System Maintenance', content: 'The system will be down for maintenance this Friday from 10 PM to 11 PM.', authorName: 'Admin User', authorRole: Role.ADMIN, timestamp: new Date(Date.now() - 86400000) }
    ]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    useEffect(() => {
        // Redirect to dashboard if user lacks permission for the current view
        if (currentUser && !currentUser.permissions[view]) {
            alert("You don't have permission to access this page. Redirecting to your dashboard.");
            setView('dashboard');
        }
    }, [view, currentUser]);

    // --- AUTH CALLBACKS ---
    const handleLogin = useCallback((email: string, pass: string) => {
        const user = users.find(u => u.email === email && u.password === pass);
        if (user) {
            setCurrentUser(user);
            setView('dashboard');
        } else {
            alert('Invalid credentials!');
        }
    }, [users]);
    const handleLogout = useCallback(() => {
        setCurrentUser(null);
    }, []);
    const updateCurrentUser = useCallback((updatedData: Partial<Pick<User, 'photoUrl' | 'password'>>) => {
        if (!currentUser) return;
        
        const updatedUser = { ...currentUser, ...updatedData };
        setCurrentUser(updatedUser);
        setUsers(prevUsers => prevUsers.map(u => u.id === currentUser.id ? updatedUser : u));

    }, [currentUser]);


    // --- CRUD CALLBACKS ---
    const addUser = useCallback((userData: Omit<User, 'id'>) => {
        const newUser: User = { ...userData, id: `u${Date.now()}`};
        setUsers(prev => [...prev, newUser]);
    }, []);
    const updateUser = useCallback((updatedUser: User) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        // If the updated user is the current user, update the current user state as well
        if (currentUser?.id === updatedUser.id) {
            setCurrentUser(updatedUser);
        }
    }, [currentUser]);
    const deleteUser = useCallback((id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
    }, []);
    const addVisitor = useCallback((visitorData: Omit<Visitor, 'id' | 'checkInTime' | 'status'>) => {
        const newVisitor: Visitor = {
            ...visitorData,
            id: new Date().toISOString(),
            checkInTime: new Date(),
            status: VisitorStatus.CHECKED_IN,
        };
        setVisitors(prev => [newVisitor, ...prev]);
        alert(`${newVisitor.name} has been checked in successfully!`);
    }, []);
    const checkOutVisitor = useCallback((id: string) => {
        setVisitors(prev => prev.map(v => v.id === id ? { ...v, status: VisitorStatus.CHECKED_OUT, checkOutTime: new Date() } : v));
    }, []);
    const addAppointment = useCallback((appointmentData: Omit<Appointment, 'id' | 'checkInCode'>) => {
        const newAppointment: Appointment = {
            ...appointmentData,
            id: new Date().toISOString(),
            checkInCode: generateCheckInCode(),
        };
        setAppointments(prev => [...prev, newAppointment].sort((a,b) => a.scheduledTime.getTime() - b.scheduledTime.getTime()));
        setNewlyCreatedAppointment(newAppointment);

        if (currentUser?.role === Role.HOST) {
            const newNotification: Notification = {
                id: `notif-${Date.now()}`,
                message: `${currentUser.name} scheduled an appointment for ${newAppointment.visitorName}.`,
                timestamp: new Date(),
                read: false,
            };
            setNotifications(prev => [newNotification, ...prev]);
        }
    }, [currentUser]);
    const addEmployee = useCallback((employeeData: Omit<Employee, 'id' | 'checkInTime' | 'status'>) => {
        const newEmployee: Employee = {
            ...employeeData,
            id: new Date().toISOString(),
            checkInTime: new Date(),
            status: EmployeeStatus.CHECKED_IN,
        };
        setEmployees(prev => [newEmployee, ...prev]);
        alert(`${newEmployee.name} has been checked in successfully!`);
    }, []);
    const checkOutEmployee = useCallback((id: string) => {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: EmployeeStatus.CHECKED_OUT, checkOutTime: new Date() } : e));
    }, []);
    const addCustomField = useCallback((fieldData: Omit<CustomField, 'id' | 'key'>) => {
        const newField: CustomField = {
            ...fieldData,
            id: new Date().toISOString(),
            key: fieldData.label.toLowerCase().replace(/\s+/g, '_'),
        };
        setCustomFields(prev => [...prev, newField]);
    }, []);
    const addAnnouncement = useCallback((announcementData: Omit<Announcement, 'id'>) => {
        const newAnnouncement: Announcement = { ...announcementData, id: `an${Date.now()}` };
        setAnnouncements(prev => [newAnnouncement, ...prev]);
    }, []);

    // --- MEMOIZED VALUES & DERIVED STATE ---
    const checkedInCount = useMemo(() => visitors.filter(v => v.status === VisitorStatus.CHECKED_IN).length, [visitors]);
    const todayAppointmentsCount = useMemo(() => appointments.filter(a => new Date(a.scheduledTime).toDateString() === new Date().toDateString()).length, [appointments]);
    const totalVisitorsToday = useMemo(() => visitors.filter(v => new Date(v.checkInTime).toDateString() === new Date().toDateString()).length, [visitors]);
    const visitorCustomFields = useMemo(() => customFields.filter(f => f.target === 'visitor'), [customFields]);
    const employeeCustomFields = useMemo(() => customFields.filter(f => f.target === 'employee'), [customFields]);

    const visitorChartData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toDateString();
            const count = visitors.filter(v => new Date(v.checkInTime).toDateString() === dateString).length;
            data.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), value: count });
        }
        return data;
    }, [visitors]);


    const renderView = () => {
        if (!currentUser) return null; // Should not happen if LoginScreen is active
        switch (view) {
            case 'dashboard':
                return (
                    <div className="space-y-8">
                        <AnnouncementBoard announcements={announcements} />
                        
                        {currentUser.role === Role.HOST && (
                             <HostDashboard currentUser={currentUser} visitors={visitors} checkOutVisitor={checkOutVisitor} />
                        )}

                        {currentUser.role !== Role.HOST && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <DashboardCard title="Currently Checked In" value={checkedInCount} description="Active visitors on-premise" />
                                <DashboardCard title="Today's Appointments" value={todayAppointmentsCount} description="Scheduled for today" />
                                <DashboardCard title="Total Visitors Today" value={totalVisitorsToday} description="Cumulative for the day" />
                            </div>
                        )}
                        
                        {currentUser.role === Role.ADMIN && (
                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                     <BarChart data={visitorChartData} title="Visitor Traffic (Last 7 Days)" />
                                </div>
                                <div>
                                    <RecentActivityFeed visitors={visitors} employees={employees} />
                                    <div className="mt-6">
                                        <AdminNotifications notifications={notifications} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'checkin':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <AppointmentCheckInTerminal 
                            addVisitor={addVisitor}
                            customFields={visitorCustomFields}
                            appointments={appointments}
                        />
                        <CheckOutTerminal 
                            visitors={visitors} 
                            checkOutVisitor={checkOutVisitor} 
                            checkOutEmployee={()=>{}}
                        />
                    </div>
                );
            case 'employees':
                 return (
                    <div className="space-y-8">
                        <EmployeeTerminal
                            addEmployee={addEmployee}
                            checkOutEmployee={checkOutEmployee}
                            customFields={employeeCustomFields}
                            employees={employees}
                        />
                        {currentUser.role !== Role.GUARD && (
                            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
                                 <h2 className="text-2xl font-bold text-gray-800 mb-6">Employee Activity Log</h2>
                                 <EmployeeLog employees={employees} checkOutEmployee={checkOutEmployee} customFields={employeeCustomFields} />
                            </div>
                        )}
                    </div>
                );
            case 'schedule':
                return <AppointmentScheduler addAppointment={addAppointment} currentUser={currentUser} />;
            case 'log':
                return <LogsPage
                    visitors={visitors}
                    employees={employees}
                    appointments={appointments}
                    checkOutVisitor={checkOutVisitor}
                    checkOutEmployee={checkOutEmployee}
                    visitorCustomFields={visitorCustomFields}
                    employeeCustomFields={employeeCustomFields}
                    currentUser={currentUser}
                />;
            case 'admin':
                return <AdminPanel customFields={customFields} addCustomField={addCustomField} users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} addAnnouncement={addAnnouncement} currentUser={currentUser} />;
            case 'ai':
                return <AIAssistant visitors={visitors} appointments={appointments}/>;
            case 'profile':
                return <UserProfilePage user={currentUser} onUpdate={updateCurrentUser} />;
            default:
                return null;
        }
    };

    const NavItem: React.FC<{ viewName: View; label: string; icon: React.ReactNode; }> = ({ viewName, label, icon }) => {
        if (!currentUser?.permissions[viewName]) {
            return null;
        }
        return (
            <button onClick={() => setView(viewName)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === viewName ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                {icon}
                <span className="hidden md:inline">{label}</span>
            </button>
        );
    };
    
    if (!currentUser) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {newlyCreatedAppointment && (
                <AppointmentConfirmationModal 
                    appointment={newlyCreatedAppointment} 
                    onClose={() => setNewlyCreatedAppointment(null)} 
                />
            )}
            <aside className="w-16 md:w-64 bg-white shadow-lg flex flex-col p-4">
                 <div className="flex items-center space-x-2 p-2 mb-4 border-b pb-4">
                     <img src={currentUser.photoUrl} alt="User" className="h-10 w-10 rounded-full object-cover" />
                     <div className="hidden md:block">
                        <h2 className="text-sm font-semibold text-gray-800">{currentUser.name}</h2>
                        <p className="text-xs text-gray-500">{currentUser.role}</p>
                     </div>
                </div>

                <nav className="flex-grow space-y-2">
                    <NavItem viewName="dashboard" label="Dashboard" icon={<HomeIcon />} />
                    <NavItem viewName="checkin" label="Walk-In" icon={<UserPlusIcon />} />
                    <NavItem viewName="employees" label="Employees" icon={<BriefcaseIcon />} />
                    <NavItem viewName="schedule" label="Schedule" icon={<CalendarPlusIcon />} />
                    <NavItem viewName="log" label="Logs" icon={<ListIcon />} />
                    <NavItem viewName="admin" label="Admin Settings" icon={<SettingsIcon />} />
                    <NavItem viewName="ai" label="AI Assistant" icon={<SparklesIcon />} />
                </nav>

                <div className="mt-auto">
                    <NavItem viewName="profile" label="My Profile" icon={<UserIcon />} />
                    <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50">
                        <LogOutIcon />
                        <span className="hidden md:inline">Sign Out</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                {renderView()}
            </main>
        </div>
    );
}
