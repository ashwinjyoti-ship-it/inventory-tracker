// Shared helpers for Pages Functions.

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

export const bad = (msg, status = 400) => json({ error: msg }, { status });

export const nowIso = () => new Date().toISOString();

const enc = new TextEncoder();
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const b64 = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const fromB64 = (str) => {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return fromB64(s);
};

// ---- settings access -------------------------------------------------------

const settingCache = new Map(); // key -> { value, ts }
const SETTING_TTL_MS = 60_000;

export async function getSetting(env, key) {
  const cached = settingCache.get(key);
  if (cached && Date.now() - cached.ts < SETTING_TTL_MS) return cached.value;
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?1").bind(key).first();
  const value = row ? row.value : null;
  settingCache.set(key, { value, ts: Date.now() });
  return value;
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, value)
    .run();
  settingCache.set(key, { value, ts: Date.now() });
}

// ---- password hashing (PBKDF2-SHA256) --------------------------------------

const PBKDF2_ITERS = 100_000;
const PBKDF2_KEYLEN = 32;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const dk = await pbkdf2(password, salt, PBKDF2_ITERS, PBKDF2_KEYLEN);
  return `pbkdf2$sha256$${PBKDF2_ITERS}$${b64(salt)}$${b64(dk)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iters = parseInt(parts[2], 10);
  if (!Number.isFinite(iters) || iters < 1000) return false;
  let salt, expected;
  try {
    salt = fromB64(parts[3]);
    expected = fromB64(parts[4]);
  } catch {
    return false;
  }
  const dk = await pbkdf2(password, salt, iters, expected.length);
  return constantTimeEq(dk, expected);
}

async function pbkdf2(password, salt, iters, keylen) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters },
    key,
    keylen * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEq(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---- admin token (HMAC-signed timestamp) -----------------------------------

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function makeAdminToken(env) {
  const signingKey = await getSetting(env, "token_signing_key");
  if (!signingKey) throw new Error("token_signing_key missing");
  const payload = String(Date.now());
  const key = await hmacKey(signingKey);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${b64url(enc.encode(payload))}.${b64url(sig)}`;
}

export async function verifyAdminToken(env, token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  let payloadBytes, sigBytes;
  try {
    payloadBytes = fromB64url(parts[0]);
    sigBytes = fromB64url(parts[1]);
  } catch {
    return false;
  }
  const signingKey = await getSetting(env, "token_signing_key");
  if (!signingKey) return false;
  const key = await hmacKey(signingKey);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!ok) return false;
  const ts = Number(new TextDecoder().decode(payloadBytes));
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > TOKEN_TTL_MS) return false;
  return true;
}

export async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : "";
  const ok = await verifyAdminToken(env, token);
  if (!ok) return bad("unauthorized", 401);
  return null;
}

// ---- request helpers -------------------------------------------------------

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const intArray = (v) =>
  Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0) : [];
