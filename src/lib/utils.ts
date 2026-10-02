import { Role } from '../types';
import type { View } from '../types';

export const ALL_VIEWS: View[] = ['dashboard', 'checkin', 'employees', 'schedule', 'log', 'ai', 'admin', 'profile'];

// Which pages each role sees. This only shapes the navigation: the real
// enforcement is server-side in convex/ (see convex/lib/tenancy.ts).
export const ROLE_VIEWS: Record<Role, View[]> = {
    [Role.ADMIN]: ['dashboard', 'checkin', 'employees', 'schedule', 'log', 'ai', 'admin', 'profile'],
    [Role.GUARD]: ['dashboard', 'checkin', 'employees', 'schedule', 'log', 'profile'],
    [Role.HOST]: ['dashboard', 'schedule', 'log', 'profile'],
};
export const canView = (role: Role, view: View) => ROLE_VIEWS[role].includes(view);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Convex `datetime-local` helper: "2026-10-02T14:30" (local time) -> epoch ms. */
export const localInputToMs = (value: string) => new Date(value).getTime();

type Row = Record<string, unknown>;

/** Flattens `extraData` into its own columns and unions the keys across all rows. */
const flatten = (rows: object[]): { keys: string[]; flat: Row[] } => {
    const flat: Row[] = rows.map(row => {
        const out: Row = {};
        for (const [k, v] of Object.entries(row as Row)) {
            if (v && typeof v === 'object' && !(v instanceof Date)) {
                for (const [sk, sv] of Object.entries(v as Row)) out[`${k}.${sk}`] = sv;
            } else {
                out[k] = v;
            }
        }
        return out;
    });
    const keys = Array.from(new Set(flat.flatMap(r => Object.keys(r))));
    return { keys, flat };
};

const cellText = (value: unknown): string =>
    value === null || value === undefined ? '' : value instanceof Date ? value.toLocaleString() : String(value);

/**
 * Visitors type their own names, so exported cells are untrusted. A leading
 * = + - @ makes Excel/Sheets run the cell as a formula; prefix it with an
 * apostrophe so it's treated as text.
 */
export const neutralizeFormula = (text: string): string => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

export const toCsv = (rows: object[]): string => {
    const { keys, flat } = flatten(rows);
    const escape = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    return [keys.join(','), ...flat.map(r => keys.map(k => escape(neutralizeFormula(cellText(r[k])))).join(','))].join('\n');
};

export const exportToCsv = (filename: string, rows: object[]) => {
    if (!rows || !rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const copyToClipboard = async (rows: object[]): Promise<void> => {
    if (!rows || !rows.length) return;
    const { keys, flat } = flatten(rows);
    const text = [keys.join('\t'), ...flat.map(r => keys.map(k => cellText(r[k]).replace(/[\t\n\r]+/g, ' ')).join('\t'))].join('\n');
    await navigator.clipboard.writeText(text);
};
