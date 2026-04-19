import { json, bad, readJson, requireAdmin } from "../../_shared.js";

// GET /api/admin/venues             — list all (incl inactive)
// POST /api/admin/venues            — create  { name, code, is_outdoor? }
// PUT  /api/admin/venues  { id, name?, code?, is_outdoor?, active? }
// DELETE /api/admin/venues?id=N     — soft delete (active=0) if any items home there
//                                     hard delete only if no items reference it
export const onRequestGet = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const { results } = await env.DB.prepare(
    `SELECT v.id, v.name, v.code, v.is_outdoor, v.active,
            (SELECT COUNT(*) FROM items WHERE home_venue_id = v.id) AS home_count,
            (SELECT COUNT(*) FROM items WHERE current_venue_id = v.id) AS current_count
       FROM venues v
       ORDER BY v.is_outdoor, v.name`,
  ).all();
  return json({ venues: results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const body = await readJson(request);
  if (!body) return bad("invalid json");
  const name = (body.name || "").toString().trim();
  const code = (body.code || "").toString().trim().toUpperCase();
  const isOutdoor = body.is_outdoor ? 1 : 0;
  if (!name || !code) return bad("name and code required");
  try {
    const r = await env.DB.prepare(
      "INSERT INTO venues (name, code, is_outdoor) VALUES (?1, ?2, ?3)",
    ).bind(name, code, isOutdoor).run();
    return json({ ok: true, id: r.meta.last_row_id });
  } catch (e) {
    return bad("duplicate name or code", 409);
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
  if (typeof body.code === "string") { sets.push(`code = ?${args.length + 1}`); args.push(body.code.trim().toUpperCase()); }
  if (body.is_outdoor != null)        { sets.push(`is_outdoor = ?${args.length + 1}`); args.push(body.is_outdoor ? 1 : 0); }
  if (body.active != null)            { sets.push(`active = ?${args.length + 1}`); args.push(body.active ? 1 : 0); }
  if (!sets.length) return bad("no fields to update");
  args.push(id);

  try {
    await env.DB.prepare(`UPDATE venues SET ${sets.join(", ")} WHERE id = ?${args.length}`).bind(...args).run();
    return json({ ok: true });
  } catch (e) {
    return bad("duplicate name or code", 409);
  }
};

export const onRequestDelete = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("id required");

  const used = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM items WHERE home_venue_id = ?1 OR current_venue_id = ?1 OR destination_venue_id = ?1) AS c",
  ).bind(id).first();
  if (used && used.c > 0) {
    await env.DB.prepare("UPDATE venues SET active = 0 WHERE id = ?1").bind(id).run();
    return json({ ok: true, soft: true });
  }
  await env.DB.prepare("DELETE FROM venues WHERE id = ?1").bind(id).run();
  return json({ ok: true, soft: false });
};
