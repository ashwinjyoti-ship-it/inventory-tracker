import {
  json,
  bad,
  readJson,
  makeAdminToken,
  verifyPassword,
  getSetting,
} from "../../_shared.js";

// POST /api/admin/login  body: { password }
// Returns { token } on success.
export const onRequestPost = async ({ request, env }) => {
  const body = await readJson(request);
  if (!body || typeof body.password !== "string") return bad("password required");

  const stored = await getSetting(env, "admin_password_hash");
  if (!stored) return bad("admin password not configured", 500);

  const ok = await verifyPassword(body.password, stored);
  if (!ok) return bad("invalid password", 401);

  const token = await makeAdminToken(env);
  return json({ token });
};
