import { json } from "../_shared.js";

// GET /api/history?limit=50&offset=0&crew_id=&venue_id=&item_id=
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const crewId = Number(url.searchParams.get("crew_id"));
  const venueId = Number(url.searchParams.get("venue_id"));
  const itemId = Number(url.searchParams.get("item_id"));

  const where = [];
  const args = [];
  if (Number.isInteger(crewId) && crewId > 0) {
    where.push(`mv.crew_id = ?${args.length + 1}`);
    args.push(crewId);
  }
  if (Number.isInteger(venueId) && venueId > 0) {
    where.push(`(mv.from_venue_id = ?${args.length + 1} OR mv.to_venue_id = ?${args.length + 1})`);
    args.push(venueId);
  }
  if (Number.isInteger(itemId) && itemId > 0) {
    where.push(`mv.item_id = ?${args.length + 1}`);
    args.push(itemId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  args.push(limit, offset);
  const sql = `
    SELECT mv.id, mv.action, mv.created_at, mv.notes,
           mv.from_venue_id, fv.code AS from_code, fv.name AS from_name,
           mv.to_venue_id,   tv.code AS to_code,   tv.name AS to_name,
           mv.crew_id, c.name AS crew_name,
           mv.item_id, i.label AS item_label, m.category
      FROM movements mv
      LEFT JOIN venues fv ON fv.id = mv.from_venue_id
      LEFT JOIN venues tv ON tv.id = mv.to_venue_id
      JOIN crew c ON c.id = mv.crew_id
      JOIN items i ON i.id = mv.item_id
      JOIN equipment_models m ON m.id = i.model_id
      ${whereSql}
     ORDER BY mv.created_at DESC, mv.id DESC
     LIMIT ?${args.length - 1} OFFSET ?${args.length}`;

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ movements: results || [] });
};
