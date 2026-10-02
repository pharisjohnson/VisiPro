import React, { useEffect, useState } from 'react';
import type { User } from '../types';

/** Where arrival texts go. Stored in E.164 by the server (0712... becomes +254712...). */
export const ProfilePhone: React.FC<{ me: User; setPhone: (memberId: string, phone: string) => Promise<boolean> }> = ({ me, setPhone }) => {
    const [phone, setValue] = useState(me.phone ?? '');
    const [saving, setSaving] = useState(false);
    useEffect(() => setValue(me.phone ?? ''), [me.phone]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await setPhone(me.id, phone);
        setSaving(false);
    };

    return (
        <form onSubmit={save} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 w-full max-w-xl">
            <h3 className="text-lg font-semibold text-gray-800">Visitor alerts by SMS</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">Add your mobile number and we'll text you when a visitor arrives to see you. Leave it empty to stop texts.</p>
            <label htmlFor="myPhone" className="block text-sm font-medium text-gray-700">Mobile number</label>
            <div className="flex gap-2 mt-1">
                <input id="myPhone" type="tel" value={phone} onChange={e => setValue(e.target.value)} placeholder="0712 345 678" className="flex-1 px-3 py-2 border border-gray-300 rounded-md" />
                <button type="submit" disabled={saving || phone === (me.phone ?? '')} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {me.phone && <p className="text-xs text-gray-500 mt-2">Saved as {me.phone}</p>}
        </form>
    );
};
