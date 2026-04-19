import { json, bad, readJson, intArray, nowIso } from "../_shared.js";

// POST /api/return
// Body: { crew_id, item_ids: [int], destination: 'home' | <venue_id>, notes? }
// For each item:
//   - must currently be checked out (current_crew_id IS NOT NULL)
//   - lands either at its home_venue_id ('home') or the supplied venue_id
// Movement row records from = previous destination_venue_id (intent), to = final venue.
export const onRequestPost = async ({ request, env }) => {
  const body = await readJson(request);
  if (!body) return bad("invalid json");

  const crewId = Number(body.crew_id);
  const itemIds = intArray(body.item_ids);
  const dest = body.destination;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

  if (!Number.isInteger(crewId) || crewId <= 0) return bad("crew_id required");
  if (itemIds.length === 0) return bad("at least one item required");
  if (dest !== "home" && !(Number.isInteger(Number(dest)) && Number(dest) > 0)) {
    return bad("destination must be 'home' or a venue id");
  }
  const destVenueId = dest === "home" ? null : Number(dest);

  const crewRow = await env.DB.prepare("SELECT id FROM crew WHERE id = ?1 AND active = 1")
    .bind(crewId)
    .first();
  if (!crewRow) return bad("unknown crew_id");

  if (destVenueId !== null) {
    const v = await env.DB.prepare("SELECT id FROM venues WHERE id = ?1 AND active = 1")
      .bind(destVenueId)
      .first();
    if (!v) return bad("unknown destination venue");
  }

  const placeholders = itemIds.map((_, i) => `?${i + 1}`).join(",");
  const rows = await env.DB.prepare(
    `SELECT id, label, current_crew_id, destination_venue_id, home_venue_id
       FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...itemIds)
    .all();

  const byId = new Map((rows.results || []).map((r) => [r.id, r]));
  for (const id of itemIds) {
    const r = byId.get(id);
    if (!r) return bad(`item ${id} not found`);
    if (r.current_crew_id == null) {
      return bad(`item "${r.label}" is not currently checked out`);
    }
    if (r.current_crew_id !== crewId) {
      return bad(`item "${r.label}" is held by a different crew member`);
    }
  }

  const ts = nowIso();
  const updateStmt = env.DB.prepare(
    `UPDATE items
        SET current_venue_id = ?1,
            current_crew_id = NULL,
            destination_venue_id = NULL,
            last_movement_at = ?2
      WHERE id = ?3`,
  );
  const moveStmt = env.DB.prepare(
    `INSERT INTO movements
       (item_id, action, from_venue_id, to_venue_id, crew_id, notes, created_at)
     VALUES (?1, 'return', ?2, ?3, ?4, ?5, ?6)`,
  );

  const batch = [];
  for (const id of itemIds) {
    const r = byId.get(id);
    const finalVenue = destVenueId ?? r.home_venue_id;
    batch.push(updateStmt.bind(finalVenue, ts, id));
    batch.push(moveStmt.bind(id, r.destination_venue_id, finalVenue, crewId, notes, ts));
  }
  await env.DB.batch(batch);

  return json({ ok: true, count: itemIds.length });
};
