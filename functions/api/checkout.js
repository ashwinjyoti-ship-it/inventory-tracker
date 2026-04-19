import { json, bad, readJson, intArray, nowIso } from "../_shared.js";

// POST /api/checkout
// Body: { crew_id, from_venue_id, to_venue_id, item_ids: [int], notes? }
// Validates each item is currently at from_venue_id; marks it in transit
// (current_venue_id NULL, current_crew_id = crew, destination_venue_id = to);
// inserts a movement row per item.
export const onRequestPost = async ({ request, env }) => {
  const body = await readJson(request);
  if (!body) return bad("invalid json");

  const crewId = Number(body.crew_id);
  const fromId = Number(body.from_venue_id);
  const toId = Number(body.to_venue_id);
  const itemIds = intArray(body.item_ids);
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

  if (!Number.isInteger(crewId) || crewId <= 0) return bad("crew_id required");
  if (!Number.isInteger(fromId) || fromId <= 0) return bad("from_venue_id required");
  if (!Number.isInteger(toId) || toId <= 0) return bad("to_venue_id required");
  if (fromId === toId) return bad("from and to venues must differ");
  if (itemIds.length === 0) return bad("at least one item required");

  // Validate crew + venues exist.
  const [crewRow, fromRow, toRow] = await Promise.all([
    env.DB.prepare("SELECT id FROM crew WHERE id = ?1 AND active = 1").bind(crewId).first(),
    env.DB.prepare("SELECT id FROM venues WHERE id = ?1 AND active = 1").bind(fromId).first(),
    env.DB.prepare("SELECT id FROM venues WHERE id = ?1 AND active = 1").bind(toId).first(),
  ]);
  if (!crewRow) return bad("unknown crew_id");
  if (!fromRow) return bad("unknown from_venue_id");
  if (!toRow) return bad("unknown to_venue_id");

  // Verify each item is currently at fromId. Bail out on the first that isn't.
  const placeholders = itemIds.map((_, i) => `?${i + 1}`).join(",");
  const itemsAtFrom = await env.DB.prepare(
    `SELECT id, label, current_venue_id, current_crew_id
       FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...itemIds)
    .all();

  const found = new Map((itemsAtFrom.results || []).map((r) => [r.id, r]));
  for (const id of itemIds) {
    const r = found.get(id);
    if (!r) return bad(`item ${id} not found`);
    if (r.current_venue_id !== fromId) {
      return bad(`item "${r.label}" is not currently at the selected source venue`);
    }
  }

  const ts = nowIso();
  const updateStmt = env.DB.prepare(
    `UPDATE items
        SET current_venue_id = NULL,
            current_crew_id = ?1,
            destination_venue_id = ?2,
            last_movement_at = ?3
      WHERE id = ?4`,
  );
  const moveStmt = env.DB.prepare(
    `INSERT INTO movements
       (item_id, action, from_venue_id, to_venue_id, crew_id, notes, created_at)
     VALUES (?1, 'checkout', ?2, ?3, ?4, ?5, ?6)`,
  );

  const batch = [];
  for (const id of itemIds) {
    batch.push(updateStmt.bind(crewId, toId, ts, id));
    batch.push(moveStmt.bind(id, fromId, toId, crewId, notes, ts));
  }
  await env.DB.batch(batch);

  return json({ ok: true, count: itemIds.length });
};
