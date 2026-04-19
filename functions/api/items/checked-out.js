import { json, bad } from "../../_shared.js";

// GET /api/items/checked-out?crew_id=N
// Items currently held by the given crew member (in transit, not yet returned).
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const crewId = Number(url.searchParams.get("crew_id"));
  if (!Number.isInteger(crewId) || crewId <= 0) return bad("crew_id required");

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.label, i.serial_no, i.last_movement_at,
            m.name AS model_name, m.category,
            hv.code AS home_venue_code, hv.id AS home_venue_id,
            dv.code AS destination_venue_code, dv.id AS destination_venue_id, dv.name AS destination_venue_name
       FROM items i
       JOIN equipment_models m ON m.id = i.model_id
       JOIN venues hv ON hv.id = i.home_venue_id
       LEFT JOIN venues dv ON dv.id = i.destination_venue_id
      WHERE i.current_crew_id = ?1
      ORDER BY i.last_movement_at DESC`,
  )
    .bind(crewId)
    .all();

  return json({ items: results || [] });
};
