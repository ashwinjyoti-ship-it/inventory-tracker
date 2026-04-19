import { json } from "../../_shared.js";

// GET /api/items/unreturned?days=5
// Items checked out (currently with a crew member) for at least N days.
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const days = Math.max(0, Number(url.searchParams.get("days") || 5));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.label, i.last_movement_at,
            m.name AS model_name, m.category,
            c.id AS crew_id, c.name AS crew_name,
            hv.code AS home_venue_code,
            dv.code AS destination_venue_code, dv.name AS destination_venue_name
       FROM items i
       JOIN equipment_models m ON m.id = i.model_id
       JOIN crew c ON c.id = i.current_crew_id
       JOIN venues hv ON hv.id = i.home_venue_id
       LEFT JOIN venues dv ON dv.id = i.destination_venue_id
      WHERE i.current_crew_id IS NOT NULL
        AND i.last_movement_at <= ?1
      ORDER BY i.last_movement_at ASC`,
  )
    .bind(cutoff)
    .all();

  return json({ days, items: results || [] });
};
