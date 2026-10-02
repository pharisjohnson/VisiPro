/**
 * Verifies a Svix/Clerk webhook signature using WebCrypto.
 * Signed content is `${svix-id}.${svix-timestamp}.${body}`, HMAC-SHA256 with the
 * base64 key after the `whsec_` prefix; the header lists `v1,<base64>` signatures.
 */
export async function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowMs: number = Date.now(),
  toleranceSec = 300,
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > toleranceSec) return false;

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    try {
      // subtle.verify compares in constant time.
      if (await crypto.subtle.verify("HMAC", key, base64ToBytes(sig) as BufferSource, data)) return true;
    } catch {
      /* malformed signature: try the next one */
    }
  }
  return false;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
