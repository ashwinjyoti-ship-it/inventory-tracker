import {
  json,
  bad,
  readJson,
  requireAdmin,
  verifyPassword,
  hashPassword,
  getSetting,
  setSetting,
} from "../../_shared.js";

// POST /api/admin/password  body: { current, next }
// Rotates the admin password (requires the current one).
export const onRequestPost = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const body = await readJson(request);
  if (!body || typeof body.current !== "string" || typeof body.next !== "string") {
    return bad("current and next required");
  }
  if (body.next.length < 6) return bad("new password too short (min 6 chars)");

  const stored = await getSetting(env, "admin_password_hash");
  const ok = await verifyPassword(body.current, stored);
  if (!ok) return bad("current password is wrong", 401);

  const hash = await hashPassword(body.next);
  await setSetting(env, "admin_password_hash", hash);
  return json({ ok: true });
};
