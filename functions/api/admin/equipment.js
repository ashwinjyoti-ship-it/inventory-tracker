import { json, requireAdmin } from "../../_shared.js";

// GET /api/admin/equipment — every item, with current location/holder + home venue.
export const onRequestGet = async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "").trim();
  const venueId = Number(url.searchParams.get("venue_id"));
  const status = url.searchParams.get("status"); // 'in_transit' | 'at_home' | 'away_from_home' | undefined

  const where = [];
  const args = [];
  if (q) {
    where.push(`(LOWER(i.label) LIKE ?${args.length + 1} OR LOWER(m.name) LIKE ?${args.length + 1})`);
    args.push(`%${q}%`);
  }
  if (category) {
    where.push(`m.category = ?${args.length + 1}`);
    args.push(category);
  }
  if (Number.isInteger(venueId) && venueId > 0) {
    where.push(`i.current_venue_id = ?${args.length + 1}`);
    args.push(venueId);
  }
  if (status === "in_transit") where.push("i.current_crew_id IS NOT NULL");
  if (status === "at_home") where.push("i.current_venue_id = i.home_venue_id");
  if (status === "away_from_home") where.push("i.current_venue_id IS NOT NULL AND i.current_venue_id != i.home_venue_id");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT i.id, i.label, i.serial_no,
           m.name AS model_name, m.category,
           hv.code AS home_code, hv.name AS home_name,
           cv.code AS current_code, cv.name AS current_name, cv.id AS current_venue_id,
           dv.code AS dest_code, dv.name AS dest_name,
           c.id AS crew_id, c.name AS crew_name,
           i.last_movement_at
      FROM items i
      JOIN equipment_models m ON m.id = i.model_id
      JOIN venues hv ON hv.id = i.home_venue_id
      LEFT JOIN venues cv ON cv.id = i.current_venue_id
      LEFT JOIN venues dv ON dv.id = i.destination_venue_id
      LEFT JOIN crew c   ON c.id = i.current_crew_id
      ${whereSql}
     ORDER BY m.category, m.name, i.serial_no`;

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ items: results || [] });
};
