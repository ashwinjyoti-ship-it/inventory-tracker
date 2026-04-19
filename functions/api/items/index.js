import { json, bad } from "../../_shared.js";

// GET /api/items?venue_id=N
// Returns items currently resident at the given venue, grouped by category/model.
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const venueId = Number(url.searchParams.get("venue_id"));
  if (!Number.isInteger(venueId) || venueId <= 0) return bad("venue_id required");

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.label, i.serial_no, i.home_venue_id,
            m.name AS model_name, m.category,
            hv.code AS home_venue_code
       FROM items i
       JOIN equipment_models m ON m.id = i.model_id
       JOIN venues hv ON hv.id = i.home_venue_id
      WHERE i.current_venue_id = ?1
      ORDER BY m.category, m.name, i.serial_no`,
  )
    .bind(venueId)
    .all();

  return json({ items: results || [] });
};
