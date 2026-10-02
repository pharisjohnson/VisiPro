import React from 'react';

export interface BadgeData {
    name: string;
    company: string;
    host: string;
    purpose: string;
    checkInTime: Date;
    companyName: string;
}

/** Local setting: whether to pop the badge dialog after every check-in on this device. */
const PROMPT_KEY = 'visipro.badgePrompt';
export const badgePromptEnabled = (): boolean => {
    try { return localStorage.getItem(PROMPT_KEY) !== 'off'; } catch { return true; }
};
export const setBadgePromptEnabled = (on: boolean) => {
    try { localStorage.setItem(PROMPT_KEY, on ? 'on' : 'off'); } catch { /* private mode: fine */ }
};

/** Print-ready visitor badge (4in x 3in label). Everything else is hidden when printing (see index.css). */
export const BadgeModal: React.FC<{ badge: BadgeData; justCheckedIn?: boolean; onClose: () => void }> = ({ badge, justCheckedIn, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Visitor badge">
        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            {justCheckedIn && <p className="text-green-600 font-semibold mb-3">✓ {badge.name} is checked in</p>}
            <div className="print-area badge-print border-2 border-gray-800 rounded-md p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-gray-500">{badge.companyName || 'Visitor'}</p>
                <p className="text-sm font-bold uppercase tracking-wider text-gray-700 mt-1">Visitor</p>
                <p className="text-3xl font-extrabold text-gray-900 leading-tight my-2 break-words">{badge.name}</p>
                {badge.company && <p className="text-lg text-gray-700">{badge.company}</p>}
                <hr className="my-2 border-gray-300" />
                <p className="text-sm text-gray-600">Visiting <strong>{badge.host}</strong></p>
                <p className="text-xs text-gray-500 mt-1">{badge.purpose} · {badge.checkInTime.toLocaleDateString()} {badge.checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end mt-5">
                {justCheckedIn && (
                    <button onClick={() => { setBadgePromptEnabled(false); onClose(); }} className="mr-auto text-xs text-gray-500 hover:text-gray-700 underline">Don't show this after check-in</button>
                )}
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">{justCheckedIn ? 'Skip' : 'Close'}</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Print badge</button>
            </div>
        </div>
    </div>
);
