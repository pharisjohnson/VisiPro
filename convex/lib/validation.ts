import type { Doc } from "../_generated/dataModel";
import { fail } from "./tenancy";

/** Trim and length-cap free text so a client can't store unbounded junk. */
export function clean(value: string | undefined, max: number, label: string): string {
  const out = (value ?? "").trim();
  if (out.length > max) fail(`${label} is too long (max ${max} characters)`);
  return out;
}

export function required(value: string, label: string): string {
  if (!value) fail(`${label} is required`);
  return value;
}

/**
 * Keeps only answers for fields that exist for this target, trims them, and
 * enforces required fields. Runs server-side so the UI can't be bypassed.
 */
export function validateExtraData(
  fields: Doc<"customFields">[],
  target: "visitor" | "employee",
  input: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (field.target !== target) continue;
    const value = clean(input[field.key], 200, field.label);
    if (field.required && !value) fail(`${field.label} is required`);
    if (value) out[field.key] = value;
  }
  return out;
}
