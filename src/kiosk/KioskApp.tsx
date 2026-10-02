import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Mode = 'home' | 'code' | 'walkin' | 'done';

const input = "mt-1 block w-full px-4 py-3 text-lg bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const bigBtn = "w-full py-4 px-6 text-xl font-semibold rounded-xl shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-60";

const REASONS: Record<string, string> = {
    invalid: 'This check-in link is no longer active. Please see reception.',
    busy: 'Too many check-ins right now. Please see reception.',
    code: "We couldn't find that code for today. Check it and try again, or choose “I'm a walk-in”.",
};

/**
 * Public self-check-in for visitors (no sign-in). The secret in the URL is the
 * only credential; everything it can do is enforced server-side in convex/kiosk.ts.
 */
export const KioskApp: React.FC<{ token: string }> = ({ token }) => {
    const info = useQuery(api.kiosk.info, { token });
    const checkIn = useMutation(api.kiosk.checkIn);
    const checkInWithCode = useMutation(api.kiosk.checkInWithCode);

    const [mode, setMode] = useState<Mode>('home');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<{ name: string; hostName: string } | null>(null);

    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [hostId, setHostId] = useState('');
    const [hostName, setHostName] = useState('');
    const [purpose, setPurpose] = useState('Meeting');
    const [code, setCode] = useState('');
    const [extraData, setExtraData] = useState<Record<string, string>>({});

    const reset = () => {
        setMode('home'); setError(''); setDone(null);
        setName(''); setCompany(''); setHostId(''); setHostName(''); setPurpose('Meeting'); setCode(''); setExtraData({});
    };

    // Return to the start screen so the next visitor doesn't see the last one's name.
    useEffect(() => {
        if (mode !== 'done') return;
        const t = setTimeout(reset, 8000);
        return () => clearTimeout(t);
    }, [mode]);

    if (info === undefined) return <Shell><p className="text-gray-500 animate-pulse text-xl">Loading…</p></Shell>;
    if (info === null) return <Shell><p className="text-xl text-gray-700">{REASONS.invalid}</p></Shell>;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const res = mode === 'code'
                ? await checkInWithCode({ token, code, extraData })
                : await checkIn({
                    token, name, company, purpose, extraData,
                    hostId: hostId ? (hostId as Id<'members'>) : undefined,
                    hostName: hostId ? undefined : hostName,
                });
            if (res.ok) {
                setDone({ name: res.name, hostName: res.hostName });
                setMode('done');
            } else {
                setError(res.message ?? REASONS[res.reason] ?? 'Something went wrong. Please see reception.');
            }
        } catch {
            setError("We couldn't reach the server. Please see reception.");
        } finally {
            setSaving(false);
        }
    };

    const customFields = info.fields.map(f => (
        <div key={f.key}>
            <label htmlFor={`k-${f.key}`} className="block text-base font-medium text-gray-700">{f.label}{f.required && ' *'}</label>
            <input id={`k-${f.key}`} type="text" value={extraData[f.key] ?? ''} required={f.required} maxLength={200}
                onChange={e => setExtraData(prev => ({ ...prev, [f.key]: e.target.value }))} className={input} />
        </div>
    ));

    return (
        <Shell title={info.companyName ? `Welcome to ${info.companyName}` : 'Welcome'}>
            {mode === 'home' && (
                <div className="space-y-4">
                    <p className="text-gray-600 text-lg mb-2">Please check in so we know you're here.</p>
                    <button onClick={() => setMode('code')} className={`${bigBtn} bg-indigo-600 text-white hover:bg-indigo-700`}>I have an appointment</button>
                    <button onClick={() => setMode('walkin')} className={`${bigBtn} bg-white text-indigo-700 border-2 border-indigo-600 hover:bg-indigo-50`}>I'm a walk-in</button>
                </div>
            )}

            {mode === 'code' && (
                <form onSubmit={submit} className="space-y-4 text-left">
                    <div>
                        <label htmlFor="k-code" className="block text-base font-medium text-gray-700">Your 6-character check-in code *</label>
                        <input id="k-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required minLength={6} maxLength={6}
                            autoCapitalize="characters" autoComplete="off" inputMode="text" className={`${input} text-center tracking-[0.4em] font-mono text-2xl`} />
                    </div>
                    {customFields}
                    {error && <p role="alert" className="text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
                    <button type="submit" disabled={saving} className={`${bigBtn} bg-indigo-600 text-white hover:bg-indigo-700`}>{saving ? 'Checking in…' : 'Check in'}</button>
                    <button type="button" onClick={reset} className="w-full text-gray-500 py-2">Back</button>
                </form>
            )}

            {mode === 'walkin' && (
                <form onSubmit={submit} className="space-y-4 text-left">
                    <div>
                        <label htmlFor="k-name" className="block text-base font-medium text-gray-700">Your full name *</label>
                        <input id="k-name" value={name} onChange={e => setName(e.target.value)} required maxLength={120} autoComplete="name" className={input} />
                    </div>
                    <div>
                        <label htmlFor="k-company" className="block text-base font-medium text-gray-700">Company</label>
                        <input id="k-company" value={company} onChange={e => setCompany(e.target.value)} maxLength={120} autoComplete="organization" className={input} />
                    </div>
                    <div>
                        <label htmlFor="k-host" className="block text-base font-medium text-gray-700">Who are you visiting? *</label>
                        {info.hosts.length > 0 ? (
                            <select id="k-host" value={hostId} onChange={e => setHostId(e.target.value)} required className={input}>
                                <option value="">Choose…</option>
                                {info.hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                        ) : (
                            <input id="k-host" value={hostName} onChange={e => setHostName(e.target.value)} required maxLength={120} className={input} />
                        )}
                    </div>
                    <div>
                        <label htmlFor="k-purpose" className="block text-base font-medium text-gray-700">Purpose of visit</label>
                        <select id="k-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} className={input}>
                            <option>Meeting</option><option>Delivery</option><option>Interview</option><option>Tour</option>
                        </select>
                    </div>
                    {customFields}
                    {error && <p role="alert" className="text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
                    <button type="submit" disabled={saving} className={`${bigBtn} bg-indigo-600 text-white hover:bg-indigo-700`}>{saving ? 'Checking in…' : 'Check in'}</button>
                    <button type="button" onClick={reset} className="w-full text-gray-500 py-2">Back</button>
                </form>
            )}

            {mode === 'done' && done && (
                <div className="space-y-4">
                    <div className="mx-auto w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-5xl" aria-hidden>✓</div>
                    <h2 className="text-2xl font-bold text-gray-800">Thank you, {done.name.split(' ')[0]}!</h2>
                    <p className="text-lg text-gray-600">{done.hostName ? `${done.hostName} has been told you're here.` : "We've let reception know you're here."} Please take a seat.</p>
                    <button onClick={reset} className="text-indigo-600 py-2">Check in someone else</button>
                </div>
            )}
        </Shell>
    );
};

const Shell: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 text-center">
            {title && <h1 className="text-3xl font-bold text-gray-800 mb-6">{title}</h1>}
            {children}
        </div>
    </div>
);
