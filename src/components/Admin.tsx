import React, { useState } from 'react';
import { OrganizationProfile } from '@clerk/clerk-react';
import type { Announcement, CustomField, Member, User } from '../types';
import { Role } from '../types';
import { MegaphoneIcon } from './icons';
import { useToast } from './Toast';

const inputCls = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500";
const primaryBtn = "w-full md:w-auto flex justify-center py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";

interface AnnouncementPosterProps {
    addAnnouncement: (a: { title: string; content: string }) => Promise<boolean>;
}
export const AnnouncementPoster: React.FC<AnnouncementPosterProps> = ({ addAnnouncement }) => {
    const toast = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            toast.error('Please provide a title and content for the announcement.');
            return;
        }
        if (await addAnnouncement({ title, content })) {
            setTitle('');
            setContent('');
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <MegaphoneIcon /> <span className="ml-2">Post an Announcement</span>
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="announcementTitle" className="block text-sm font-medium text-gray-700">Title</label>
                    <input type="text" id="announcementTitle" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className={inputCls} />
                </div>
                <div>
                    <label htmlFor="announcementContent" className="block text-sm font-medium text-gray-700">Content</label>
                    <textarea id="announcementContent" value={content} onChange={(e) => setContent(e.target.value)} required rows={4} maxLength={2000} className={inputCls} />
                </div>
                <button type="submit" className={primaryBtn}>Post Announcement</button>
            </form>
        </div>
    );
};

interface TeamPanelProps {
    members: Member[];
    currentUser: User;
    setRole: (memberId: string, role: Role) => Promise<boolean>;
}
export const TeamPanel: React.FC<TeamPanelProps> = ({ members, currentUser, setRole }) => {
    const [inviteOpen, setInviteOpen] = useState(false);

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-gray-800">Team</h3>
                <button onClick={() => setInviteOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Invite &amp; manage members</button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
                <strong>Admin</strong> manages everything. <strong>Guard</strong> checks visitors and staff in and out. <strong>Host</strong> sees only their own visitors and appointments.
            </p>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {members.map(m => (
                            <tr key={m.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        {m.photoUrl
                                            ? <img className="h-10 w-10 rounded-full object-cover" src={m.photoUrl} alt="" />
                                            : <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">{m.name.charAt(0).toUpperCase()}</div>}
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{m.name}{m.userId === currentUser.userId && <span className="ml-2 text-xs text-gray-400">(you)</span>}</div>
                                            <div className="text-sm text-gray-500">{m.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <select
                                        value={m.role}
                                        onChange={(e) => setRole(m.id, e.target.value as Role)}
                                        className="border border-gray-300 rounded-md px-2 py-1"
                                        aria-label={`Role for ${m.name}`}
                                    >
                                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {inviteOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start overflow-y-auto z-50 p-4" onClick={() => setInviteOpen(false)}>
                    <div className="my-8" onClick={(e) => e.stopPropagation()}>
                        <OrganizationProfile routing="virtual" />
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminPanelProps {
    customFields: CustomField[];
    addCustomField: (field: { label: string; target: 'visitor' | 'employee'; required: boolean }) => Promise<boolean>;
    removeCustomField: (id: string) => Promise<boolean>;
    members: Member[];
    setRole: (memberId: string, role: Role) => Promise<boolean>;
    addAnnouncement: (a: { title: string; content: string }) => Promise<boolean>;
    currentUser: User;
}
export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const toast = useToast();
    const [label, setLabel] = useState('');
    const [target, setTarget] = useState<'visitor' | 'employee'>('visitor');
    const [required, setRequired] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) {
            toast.error('Please provide a field label.');
            return;
        }
        if (await props.addCustomField({ label, target, required })) {
            setLabel('');
            setTarget('visitor');
            setRequired(false);
        }
    };

    const fieldList = (title: string, fields: CustomField[], empty: string) => (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
            <ul className="space-y-2 text-gray-600">
                {fields.length > 0 ? fields.map(f => (
                    <li key={f.id} className="flex justify-between items-center">
                        <span>{f.label} {f.required && <span className="text-xs text-gray-400">(Required)</span>}</span>
                        <button onClick={() => window.confirm(`Remove "${f.label}"? Existing records keep their saved answers.`) && props.removeCustomField(f.id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                    </li>
                )) : <li>{empty}</li>}
            </ul>
        </div>
    );

    return (
        <div className="space-y-8">
            <AnnouncementPoster addAnnouncement={props.addAnnouncement} />
            <TeamPanel members={props.members} currentUser={props.currentUser} setRole={props.setRole} />
            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Custom Fields</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label htmlFor="fieldLabel" className="block text-sm font-medium text-gray-700">Field Label</label>
                        <input type="text" id="fieldLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., National ID" maxLength={60} className={inputCls} />
                    </div>
                    <div>
                        <label htmlFor="fieldTarget" className="block text-sm font-medium text-gray-700">Applies To</label>
                        <select id="fieldTarget" value={target} onChange={(e) => setTarget(e.target.value as 'visitor' | 'employee')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md">
                            <option value="visitor">Visitor</option>
                            <option value="employee">Employee</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-start pt-6">
                        <input type="checkbox" id="fieldRequired" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor="fieldRequired" className="ml-2 block text-sm text-gray-900">Required</label>
                    </div>
                    <div className="md:col-span-4">
                        <button type="submit" className={primaryBtn}>Add Field</button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {fieldList('Current Visitor Fields', props.customFields.filter(f => f.target === 'visitor'), 'No visitor fields defined.')}
                {fieldList('Current Employee Fields', props.customFields.filter(f => f.target === 'employee'), 'No employee fields defined.')}
            </div>
        </div>
    );
};
