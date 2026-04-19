import { json, bad, readJson, requireAdmin } from "../../_shared.js";

// CRUD for crew members (admin only).
export const onRequestGet = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.role, c.active,
            (SELECT COUNT(*) FROM items WHERE current_crew_id = c.id) AS holding_count
       FROM crew c ORDER BY c.role DESC, c.name`,
  ).all();
  return json({ crew: results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const body = await readJson(request);
  if (!body) return bad("invalid json");
  const name = (body.name || "").toString().trim();
  const role = body.role === "head" ? "head" : "member";
  if (!name) return bad("name required");
  try {
    const r = await env.DB.prepare("INSERT INTO crew (name, role) VALUES (?1, ?2)")
      .bind(name, role).run();
    return json({ ok: true, id: r.meta.last_row_id });
  } catch {
    return bad("name already exists", 409);
  }
};

export const onRequestPut = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const body = await readJson(request);
  if (!body) return bad("invalid json");
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return bad("id required");
  const sets = [];
  const args = [];
  if (typeof body.name === "string") { sets.push(`name = ?${args.length + 1}`); args.push(body.name.trim()); }
  if (body.role === "head" || body.role === "member") { sets.push(`role = ?${args.length + 1}`); args.push(body.role); }
  if (body.active != null) { sets.push(`active = ?${args.length + 1}`); args.push(body.active ? 1 : 0); }
  if (!sets.length) return bad("no fields to update");
  args.push(id);
  try {
    await env.DB.prepare(`UPDATE crew SET ${sets.join(", ")} WHERE id = ?${args.length}`).bind(...args).run();
    return json({ ok: true });
  } catch {
    return bad("name already exists", 409);
  }
};

export const onRequestDelete = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("id required");

  const refs = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM items WHERE current_crew_id = ?1) + (SELECT COUNT(*) FROM movements WHERE crew_id = ?1) AS c",
  ).bind(id).first();
  if (refs && refs.c > 0) {
    await env.DB.prepare("UPDATE crew SET active = 0 WHERE id = ?1").bind(id).run();
    return json({ ok: true, soft: true });
  }
  await env.DB.prepare("DELETE FROM crew WHERE id = ?1").bind(id).run();
  return json({ ok: true, soft: false });
};
