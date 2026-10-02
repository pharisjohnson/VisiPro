import React, { useState, useMemo, useEffect } from 'react';
import type { Visitor, Appointment, Employee, CustomField, User, Announcement, Notification, Member } from '../types';
import { VisitorStatus, EmployeeStatus, Role } from '../types';
import * as Icons from './icons';
const { HomeIcon, UserPlusIcon, BriefcaseIcon, CalendarPlusIcon, ListIcon, SparklesIcon, SettingsIcon, ChevronDownIcon, ChevronUpIcon, MegaphoneIcon, BarChartIcon, BellIcon } = Icons;
import { exportToCsv, copyToClipboard } from '../lib/utils';
import { useToast } from './Toast';

export interface DashboardCardProps {
  title: string;
  value: string | number;
  description: string;
}
export const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, description }) => (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-3xl font-bold text-indigo-600 mt-2">{value}</p>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
);

export interface BarChartProps {
    data: { name: string; value: number }[];
    title: string;
}
export const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
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

export interface RecentActivityFeedProps {
    visitors: Visitor[];
    employees: Employee[];
}
export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ visitors, employees }) => {
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

export const AnnouncementBoard: React.FC<{ announcements: Announcement[] }> = ({ announcements }) => {
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

export interface NotificationsPanelProps {
    notifications: Notification[];
    onMarkRead: (id: string) => void;
}
export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ notifications, onMarkRead }) => {
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
                    <div key={notif.id} className={`p-3 rounded-md flex justify-between items-start gap-3 ${notif.read ? 'bg-gray-50' : 'bg-amber-50'}`}>
                        <div>
                            <p className="text-sm text-gray-700">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{notif.timestamp.toLocaleString()}</p>
                        </div>
                        {!notif.read && <button onClick={() => onMarkRead(notif.id)} className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap">Mark read</button>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export interface HostDashboardProps {
    currentUser: User;
    visitors: Visitor[];
    checkOutVisitor: (id: string) => void;
}
export const HostDashboard: React.FC<HostDashboardProps> = ({ currentUser, visitors, checkOutVisitor }) => {
    // The server only returns this host's own visitors; the filter keeps the intent explicit.
    const myVisitors = visitors.filter(v => v.hostUserId === currentUser.userId && v.status === VisitorStatus.CHECKED_IN);

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
                                <p className="text-sm text-gray-600">{visitor.company ? `${visitor.company} - ` : ''}Arrived at {visitor.checkInTime.toLocaleTimeString()}</p>
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
