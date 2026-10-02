import React, { useEffect, useMemo, useState } from 'react';
import { OrganizationList, OrganizationSwitcher, SignIn, SignUp, UserButton, UserProfile, useOrganization, useUser } from '@clerk/clerk-react';
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Appointment, Employee, View, Visitor } from './types';
import { Role } from './types';
import { canView, DAY_MS, startOfDay } from './lib/utils';
import { errorMessage } from './lib/errors';
import { toAnnouncement, toAppointment, toCustomField, toEmployee, toMember, toNotification, toVisitor } from './lib/mappers';
import { useActions } from './hooks/useActions';
import { useOnline } from './hooks/useOnline';
import { ToastProvider } from './components/Toast';
import { BriefcaseIcon, CalendarPlusIcon, HomeIcon, ListIcon, SettingsIcon, SparklesIcon, UserIcon, UserPlusIcon } from './components/icons';
import { AnnouncementBoard, BarChart, DashboardCard, HostDashboard, NotificationsPanel, RecentActivityFeed } from './components/Dashboard';
import { AppointmentCheckInTerminal, CheckOutTerminal, EmployeeTerminal } from './components/CheckIn';
import { EmployeeLog, LogsPage } from './components/Logs';
import { AppointmentConfirmationModal, AppointmentScheduler } from './components/Schedule';
import { AdminPanel } from './components/Admin';
import { AIAssistant } from './components/AIAssistant';

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">{children}</div>
);

const NavItem: React.FC<{ active: boolean; label: string; icon: React.ReactNode; onClick: () => void }> = ({ active, label, icon, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
        {icon}
        <span className="hidden md:inline">{label}</span>
    </button>
);

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { view: 'checkin', label: 'Walk-In', icon: <UserPlusIcon /> },
    { view: 'employees', label: 'Employees', icon: <BriefcaseIcon /> },
    { view: 'schedule', label: 'Schedule', icon: <CalendarPlusIcon /> },
    { view: 'log', label: 'Logs', icon: <ListIcon /> },
    { view: 'admin', label: 'Admin Settings', icon: <SettingsIcon /> },
    { view: 'ai', label: 'AI Assistant', icon: <SparklesIcon /> },
];

/** Signed in with Clerk but no active organization yet: pick or create one. */
const ChooseOrganization: React.FC = () => (
    <Centered>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Choose your organization</h1>
        <p className="text-gray-500 mb-6 max-w-md">Create your company's workspace, or join one you've been invited to.</p>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
    </Centered>
);

/** Creates the caller's member record on first visit, then renders the workspace. */
const Bootstrap: React.FC = () => {
    const { user } = useUser();
    const ensure = useMutation(api.members.ensure);
    const me = useQuery(api.members.me);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        setError(null);
        ensure({
            name: user.fullName || user.primaryEmailAddress?.emailAddress || 'User',
            email: user.primaryEmailAddress?.emailAddress ?? '',
            photoUrl: user.imageUrl,
        }).catch((e) => setError(errorMessage(e)));
    }, [user?.id, user?.fullName, user?.imageUrl, ensure]);

    if (error) {
        return (
            <Centered>
                <h1 className="text-xl font-bold text-gray-800 mb-2">We couldn't open your workspace</h1>
                <p className="text-gray-600 max-w-md mb-2">{error}</p>
                <p className="text-sm text-gray-400 max-w-md">If this says "No active organization", the Clerk JWT template named <code>convex</code> is missing the <code>org_id</code> and <code>org_role</code> claims. See the README.</p>
            </Centered>
        );
    }
    if (!me) return <Centered><p className="text-gray-500 animate-pulse">Opening your workspace…</p></Centered>;
    return <Workspace me={toMember(me)} />;
};

const Workspace: React.FC<{ me: ReturnType<typeof toMember> }> = ({ me }) => {
    const actions = useActions();
    const online = useOnline();
    const [view, setView] = useState<View>('dashboard');
    const [newAppointment, setNewAppointment] = useState<Appointment | null>(null);

    const isAdmin = me.role === Role.ADMIN;
    const isStaff = me.role === Role.ADMIN || me.role === Role.GUARD;
    const activeView: View = canView(me.role, view) ? view : 'dashboard';

    // "Today" rolls over at local midnight even if the tab stays open.
    const [dayStart, setDayStart] = useState(() => startOfDay(new Date()));
    useEffect(() => {
        const t = setInterval(() => setDayStart(startOfDay(new Date())), 60_000);
        return () => clearInterval(t);
    }, []);
    const weekStart = useMemo(() => {
        const d = new Date(dayStart);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).getTime();
    }, [dayStart]);

    // Role-scoped live queries. The server enforces the same rules; "skip" just avoids calls we know would be refused.
    const membersDocs = useQuery(api.members.list);
    const fieldDocs = useQuery(api.customFields.list);
    const announcementDocs = useQuery(api.announcements.list);
    const notificationDocs = useQuery(api.notifications.mine);
    const onPremiseDocs = useQuery(api.visitors.onPremise);
    const appointmentDocs = useQuery(api.appointments.list);
    const weekDocs = useQuery(api.visitors.since, isStaff ? { since: weekStart } : 'skip');
    const logDocs = useQuery(api.visitors.log, isStaff ? {} : 'skip');
    const employeeDocs = useQuery(api.employees.list, isStaff ? {} : 'skip');
    const expectedDocs = useQuery(api.appointments.expected, isStaff ? { from: dayStart, to: dayStart + DAY_MS } : 'skip');

    const members = useMemo(() => (membersDocs ?? []).map(toMember), [membersDocs]);
    const customFields = useMemo(() => (fieldDocs ?? []).map(toCustomField), [fieldDocs]);
    const announcements = useMemo(() => (announcementDocs ?? []).map(toAnnouncement), [announcementDocs]);
    const notifications = useMemo(() => (notificationDocs ?? []).map(toNotification), [notificationDocs]);
    const onPremise = useMemo<Visitor[]>(() => (onPremiseDocs ?? []).map(toVisitor), [onPremiseDocs]);
    const appointments = useMemo<Appointment[]>(() => (appointmentDocs ?? []).map(toAppointment), [appointmentDocs]);
    const weekVisitors = useMemo<Visitor[]>(() => (weekDocs ?? []).map(toVisitor), [weekDocs]);
    const visitorLog = useMemo<Visitor[]>(() => (logDocs ?? []).map(toVisitor), [logDocs]);
    const employees = useMemo<Employee[]>(() => (employeeDocs ?? []).map(toEmployee), [employeeDocs]);
    const expected = useMemo<Appointment[]>(() => (expectedDocs ?? []).map(toAppointment), [expectedDocs]);

    const visitorFields = useMemo(() => customFields.filter(f => f.target === 'visitor'), [customFields]);
    const employeeFields = useMemo(() => customFields.filter(f => f.target === 'employee'), [customFields]);

    const todaysAppointmentsCount = useMemo(
        () => appointments.filter(a => a.status !== 'cancelled' && a.scheduledTime.getTime() >= dayStart && a.scheduledTime.getTime() < dayStart + DAY_MS).length,
        [appointments, dayStart],
    );
    const totalVisitorsToday = useMemo(() => weekVisitors.filter(v => v.checkInTime.getTime() >= dayStart).length, [weekVisitors, dayStart]);
    const visitorChartData = useMemo(() => {
        const base = new Date(dayStart);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - (6 - i));
            const from = d.getTime();
            const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
            return {
                name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                value: weekVisitors.filter(v => v.checkInTime.getTime() >= from && v.checkInTime.getTime() < to).length,
            };
        });
    }, [weekVisitors, dayStart]);

    const handleAddAppointment = async (a: Parameters<typeof actions.addAppointment>[0]) => {
        const created = await actions.addAppointment(a);
        if (created) setNewAppointment(created);
        return created !== null;
    };

    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return (
                    <div className="space-y-8">
                        <NotificationsPanel notifications={notifications} onMarkRead={actions.markNotificationRead} />
                        <AnnouncementBoard announcements={announcements} />

                        {me.role === Role.HOST && (
                            <HostDashboard currentUser={me} visitors={onPremise} checkOutVisitor={actions.checkOutVisitor} />
                        )}

                        {isStaff && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <DashboardCard title="Currently Checked In" value={onPremise.length} description="Active visitors on-premise" />
                                <DashboardCard title="Today's Appointments" value={todaysAppointmentsCount} description="Scheduled for today" />
                                <DashboardCard title="Total Visitors Today" value={totalVisitorsToday} description="Cumulative for the day" />
                            </div>
                        )}

                        {isAdmin && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <BarChart data={visitorChartData} title="Visitor Traffic (Last 7 Days)" />
                                </div>
                                <div>
                                    <RecentActivityFeed visitors={weekVisitors} employees={employees} />
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'checkin':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <AppointmentCheckInTerminal addVisitor={actions.addVisitor} customFields={visitorFields} appointments={expected} members={members} />
                        <CheckOutTerminal visitors={onPremise} checkOutVisitor={actions.checkOutVisitor} />
                    </div>
                );
            case 'employees':
                return (
                    <div className="space-y-8">
                        <EmployeeTerminal addEmployee={actions.addEmployee} checkOutEmployee={actions.checkOutEmployee} customFields={employeeFields} employees={employees} />
                        {isAdmin && (
                            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">Employee Activity Log</h2>
                                <EmployeeLog employees={employees} checkOutEmployee={actions.checkOutEmployee} customFields={employeeFields} />
                            </div>
                        )}
                    </div>
                );
            case 'schedule':
                return <AppointmentScheduler addAppointment={handleAddAppointment} currentUser={me} members={members} />;
            case 'log':
                return (
                    <LogsPage
                        visitors={visitorLog}
                        employees={employees}
                        appointments={appointments}
                        checkOutVisitor={actions.checkOutVisitor}
                        checkOutEmployee={actions.checkOutEmployee}
                        visitorCustomFields={visitorFields}
                        employeeCustomFields={employeeFields}
                        currentUser={me}
                    />
                );
            case 'admin':
                return (
                    <AdminPanel
                        customFields={customFields}
                        addCustomField={actions.addCustomField}
                        removeCustomField={actions.removeCustomField}
                        members={members}
                        setRole={actions.setRole}
                        addAnnouncement={actions.addAnnouncement}
                        currentUser={me}
                    />
                );
            case 'ai':
                return <AIAssistant />;
            case 'profile':
                return <div className="flex justify-center"><UserProfile routing="virtual" /></div>;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {newAppointment && (
                <AppointmentConfirmationModal appointment={newAppointment} onClose={() => setNewAppointment(null)} />
            )}
            <aside className="w-16 md:w-64 bg-white shadow-lg flex flex-col p-4">
                <div className="p-2 mb-4 border-b pb-4 space-y-3">
                    <div className="hidden md:block">
                        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <UserButton />
                        <div className="hidden md:block">
                            <h2 className="text-sm font-semibold text-gray-800">{me.name}</h2>
                            <p className="text-xs text-gray-500">{me.role}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-grow space-y-2">
                    {NAV.filter(n => canView(me.role, n.view)).map(n => (
                        <NavItem key={n.view} active={activeView === n.view} label={n.label} icon={n.icon} onClick={() => setView(n.view)} />
                    ))}
                </nav>

                <div className="mt-auto">
                    <NavItem active={activeView === 'profile'} label="My Profile" icon={<UserIcon />} onClick={() => setView('profile')} />
                </div>
            </aside>
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                {!online && (
                    <div className="mb-6 px-4 py-3 rounded-md bg-amber-100 text-amber-900 text-sm" role="alert">
                        You're offline. Check-ins and changes can't be saved until the connection returns, so keep a paper backup for now.
                    </div>
                )}
                {renderView()}
            </main>
        </div>
    );
};

const OrgRouter: React.FC = () => {
    // The Convex token follows Clerk's active organization, so route on that.
    const { isLoaded, organization } = useOrganization();
    if (!isLoaded) return <Centered><p className="text-gray-500 animate-pulse">Loading…</p></Centered>;
    // key: switching organizations must re-run the member bootstrap for the new org.
    return organization ? <Bootstrap key={organization.id} /> : <ChooseOrganization />;
};

const AuthScreen: React.FC = () => {
    const [mode, setMode] = useState<'in' | 'up'>('in');
    return (
        <Centered>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome to VisiPro</h1>
            <p className="text-gray-500 mb-6">{mode === 'in' ? 'Sign in to manage your visitors' : 'Create an account to get started'}</p>
            {mode === 'in' ? <SignIn routing="virtual" /> : <SignUp routing="virtual" />}
            <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">
                {mode === 'in' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </button>
        </Centered>
    );
};

export default function App() {
    return (
        <ToastProvider>
            <AuthLoading>
                <Centered><p className="text-gray-500 animate-pulse">Loading…</p></Centered>
            </AuthLoading>
            <Unauthenticated>
                <AuthScreen />
            </Unauthenticated>
            <Authenticated>
                <OrgRouter />
            </Authenticated>
        </ToastProvider>
    );
}
