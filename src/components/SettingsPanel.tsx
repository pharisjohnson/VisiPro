import React, { useEffect, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../convex/_generated/api';
import { useToast } from './Toast';
import { errorMessage } from '../lib/errors';
import { badgePromptEnabled, setBadgePromptEnabled } from './Badge';

const card = "bg-white p-8 rounded-lg shadow-lg border border-gray-200";
const inputCls = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500";
const primaryBtn = "px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300";
const secondaryBtn = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50";

const OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12).map(h => ({
    minutes: h * 60,
    label: `UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}${h === 3 ? ' (Kenya, Uganda, Tanzania, Ethiopia)' : h === 2 ? ' (Rwanda, Burundi)' : ''}`,
}));

const KIND_LABEL = { host_arrival: 'Host alert', visitor_code: 'Visitor code' } as const;
const STATUS_STYLE = { sent: 'bg-green-100 text-green-800', queued: 'bg-amber-100 text-amber-800', failed: 'bg-red-100 text-red-800' } as const;

export const SettingsPanel: React.FC = () => {
    const settings = useQuery(api.settings.getAdmin);
    const sms = useQuery(api.sms.recent);
    if (settings === undefined) return <div className={card}><p className="text-gray-500 animate-pulse">Loading settings…</p></div>;
    return (
        <div className="space-y-8">
            <GeneralSettings settings={settings} />
            <KioskSettings token={settings.kioskToken} companyName={settings.companyName} />
            <div className={card}>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Recent text messages</h3>
                <p className="text-sm text-gray-500 mb-4">The last 30 SMS sent for your organization. Numbers are partly hidden.</p>
                {!sms || sms.length === 0 ? <p className="text-gray-500 text-sm">Nothing sent yet.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-2 pr-4">When</th><th className="pr-4">Type</th><th className="pr-4">To</th><th>Status</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {sms.map(m => (
                                    <tr key={m.id}>
                                        <td className="py-2 pr-4 whitespace-nowrap">{new Date(m.sentAt).toLocaleString()}</td>
                                        <td className="pr-4">{KIND_LABEL[m.kind]}</td>
                                        <td className="pr-4 font-mono">{m.to}</td>
                                        <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[m.status]}`}>{m.status}</span>{m.error && <span className="ml-2 text-xs text-gray-500">{m.error}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

type AdminSettings = NonNullable<ReturnType<typeof useQuery<typeof api.settings.getAdmin>>>;

const GeneralSettings: React.FC<{ settings: AdminSettings }> = ({ settings }) => {
    const toast = useToast();
    const update = useMutation(api.settings.update);
    const [companyName, setCompanyName] = useState(settings.companyName);
    const [utcOffsetMinutes, setOffset] = useState(settings.utcOffsetMinutes);
    const [autoCheckoutHours, setHours] = useState(String(settings.autoCheckoutHours));
    const [smsHostOnArrival, setHostSms] = useState(settings.smsHostOnArrival);
    const [smsVisitorCode, setVisitorSms] = useState(settings.smsVisitorCode);
    const [saving, setSaving] = useState(false);
    const [badgePrompt, setBadgePrompt] = useState(badgePromptEnabled());

    // Pick up changes saved elsewhere (another admin, another tab).
    useEffect(() => {
        setCompanyName(settings.companyName); setOffset(settings.utcOffsetMinutes); setHours(String(settings.autoCheckoutHours));
        setHostSms(settings.smsHostOnArrival); setVisitorSms(settings.smsVisitorCode);
    }, [settings.companyName, settings.utcOffsetMinutes, settings.autoCheckoutHours, settings.smsHostOnArrival, settings.smsVisitorCode]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await update({ companyName, utcOffsetMinutes, autoCheckoutHours: Number(autoCheckoutHours), smsHostOnArrival, smsVisitorCode });
            toast.success('Settings saved.');
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={save} className={card}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Organization settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Company name</label>
                    <input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} required maxLength={80} className={inputCls} />
                    <p className="text-xs text-gray-500 mt-1">Shown on badges, the kiosk and text messages.</p>
                </div>
                <div>
                    <label htmlFor="tz" className="block text-sm font-medium text-gray-700">Time zone</label>
                    <select id="tz" value={utcOffsetMinutes} onChange={e => setOffset(Number(e.target.value))} className={inputCls}>
                        {OFFSETS.map(o => <option key={o.minutes} value={o.minutes}>{o.label}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Used for times in text messages.</p>
                </div>
                <div>
                    <label htmlFor="autoCheckout" className="block text-sm font-medium text-gray-700">Auto check-out after (hours)</label>
                    <input id="autoCheckout" type="number" min={0} max={72} step={1} value={autoCheckoutHours} onChange={e => setHours(e.target.value)} required className={inputCls} />
                    <p className="text-xs text-gray-500 mt-1">Visitors and staff nobody checked out are closed after this long and marked “auto”. 0 turns it off.</p>
                </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mt-8 mb-2">Text messages (SMS)</h3>
            {!settings.smsProviderConfigured && (
                <p className="text-sm bg-amber-50 text-amber-800 rounded-md p-3 mb-3">
                    SMS isn't switched on for this deployment yet. The developer needs to set <code>AT_USERNAME</code> and <code>AT_API_KEY</code> (Africa's Talking). Until then these options do nothing.
                </p>
            )}
            <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-800">
                    <input type="checkbox" checked={smsHostOnArrival} onChange={e => setHostSms(e.target.checked)} className="mt-1 h-4 w-4" />
                    <span>Text the host when their visitor arrives <span className="text-gray-500">(hosts add their number under My Profile)</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-800">
                    <input type="checkbox" checked={smsVisitorCode} onChange={e => setVisitorSms(e.target.checked)} className="mt-1 h-4 w-4" />
                    <span>Text visitors their check-in code when an appointment has their number</span>
                </label>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mt-8 mb-2">This device</h3>
            <label className="flex items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={badgePrompt} onChange={e => { setBadgePrompt(e.target.checked); setBadgePromptEnabled(e.target.checked); }} className="mt-1 h-4 w-4" />
                <span>Offer to print a badge after each check-in</span>
            </label>

            <div className="mt-8"><button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : 'Save settings'}</button></div>
        </form>
    );
};

const KioskSettings: React.FC<{ token: string | null; companyName: string }> = ({ token, companyName }) => {
    const toast = useToast();
    const rotate = useAction(api.kioskAdmin.rotateToken);
    const disable = useMutation(api.settings.disableKiosk);
    const [busy, setBusy] = useState(false);
    const [poster, setPoster] = useState(false);
    const url = token ? `${window.location.origin}/k/${token}` : '';

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try { await fn(); toast.success(ok); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
    };

    return (
        <div className={card}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Visitor self check-in</h3>
            <p className="text-sm text-gray-500 mb-4">
                A link and QR code visitors can use on their own phone, or on a tablet at the gate, with no login. Anyone with the link can check in, so keep the poster at your entrance and
                <strong> rotate the link</strong> if it leaks. Check-ins are rate-limited.
            </p>
            {!token ? (
                <button disabled={busy} onClick={() => run(() => rotate({}), 'Self check-in enabled.')} className={primaryBtn}>Enable self check-in</button>
            ) : (
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="p-3 bg-white border rounded-lg"><QRCodeSVG value={url} size={150} /></div>
                    <div className="flex-1 min-w-0 space-y-3">
                        <input readOnly value={url} onFocus={e => e.currentTarget.select()} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono bg-gray-50" aria-label="Self check-in link" />
                        <div className="flex flex-wrap gap-2">
                            <button className={secondaryBtn} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied.'))}>Copy link</button>
                            <button className={secondaryBtn} onClick={() => setPoster(true)}>Print poster</button>
                            <button className={secondaryBtn} disabled={busy} onClick={() => window.confirm('This makes the current link and any printed QR codes stop working. Continue?') && run(() => rotate({}), 'New link created. Reprint your poster.')}>Rotate link</button>
                            <button className={`${secondaryBtn} text-red-700`} disabled={busy} onClick={() => window.confirm('Turn off self check-in? The current link and QR codes will stop working.') && run(() => disable({}), 'Self check-in turned off.')}>Turn off</button>
                        </div>
                    </div>
                </div>
            )}
            {poster && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <div className="print-area text-center p-8">
                            <h2 className="text-4xl font-extrabold text-gray-900">{companyName || 'Welcome'}</h2>
                            <p className="text-2xl text-gray-700 mt-2 mb-6">Visitors: scan to check in</p>
                            <div className="inline-block p-4 bg-white border-4 border-gray-900 rounded-xl"><QRCodeSVG value={url} size={320} /></div>
                            <p className="text-sm text-gray-500 mt-6 break-all">{url}</p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button className={secondaryBtn} onClick={() => setPoster(false)}>Close</button>
                            <button className={primaryBtn} onClick={() => window.print()}>Print</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
