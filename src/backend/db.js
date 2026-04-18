// Database query helpers for Cloudflare D1

export class Database {
  constructor(env) {
    this.db = env.DB;
  }

  async query(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return result;
    } catch (error) {
      console.error('DB Query Error:', error, 'SQL:', sql);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return result;
    } catch (error) {
      console.error('DB Run Error:', error, 'SQL:', sql);
      throw error;
    }
  }

  async first(sql, params = []) {
    const result = await this.query(sql, params);
    return result.results?.[0] || null;
  }

  // Items queries
  async getItems(filters = {}) {
    let sql = `
      SELECT i.*, e.name as equipment_name, e.category,
             v1.name as current_venue_name, v2.name as home_venue_name
      FROM items i
      JOIN equipment e ON i.equipment_id = e.id
      JOIN venues v1 ON i.current_venue_id = v1.id
      JOIN venues v2 ON i.home_venue_id = v2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ` AND i.status = ?`;
      params.push(filters.status);
    }

    if (filters.current_venue_id) {
      sql += ` AND i.current_venue_id = ?`;
      params.push(filters.current_venue_id);
    }

    if (filters.equipment_id) {
      sql += ` AND i.equipment_id = ?`;
      params.push(filters.equipment_id);
    }

    sql += ` ORDER BY e.name, i.item_number`;
    return this.query(sql, params);
  }

  async getItem(id) {
    const sql = `
      SELECT i.*, e.name as equipment_name, e.category,
             v1.name as current_venue_name, v2.name as home_venue_name
      FROM items i
      JOIN equipment e ON i.equipment_id = e.id
      JOIN venues v1 ON i.current_venue_id = v1.id
      JOIN venues v2 ON i.home_venue_id = v2.id
      WHERE i.id = ?
    `;
    return this.first(sql, [id]);
  }

  async updateItemLocation(itemId, venueId) {
    const sql = `UPDATE items SET current_venue_id = ?, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return this.run(sql, [venueId, itemId]);
  }

  async updateItemStatus(itemId, status) {
    const sql = `UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return this.run(sql, [status, itemId]);
  }

  // Movements queries
  async createMovement(itemId, crewMemberId, fromVenueId, toVenueId, movementType, notes = '') {
    const sql = `
      INSERT INTO movements (item_id, crew_member_id, from_venue_id, to_venue_id, movement_type, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return this.run(sql, [itemId, crewMemberId, fromVenueId, toVenueId, movementType, notes]);
  }

  async getMovements(filters = {}) {
    let sql = `
      SELECT m.*, i.item_number, e.name as equipment_name,
             c.name as crew_member_name,
             v1.name as from_venue_name, v2.name as to_venue_name
      FROM movements m
      JOIN items i ON m.item_id = i.id
      JOIN equipment e ON i.equipment_id = e.id
      JOIN crew_members c ON m.crew_member_id = c.id
      JOIN venues v1 ON m.from_venue_id = v1.id
      JOIN venues v2 ON m.to_venue_id = v2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.item_id) {
      sql += ` AND m.item_id = ?`;
      params.push(filters.item_id);
    }

    if (filters.crew_member_id) {
      sql += ` AND m.crew_member_id = ?`;
      params.push(filters.crew_member_id);
    }

    if (filters.movement_type) {
      sql += ` AND m.movement_type = ?`;
      params.push(filters.movement_type);
    }

    sql += ` ORDER BY m.logged_at DESC`;
    return this.query(sql, params);
  }

  async getItemHistory(itemId) {
    const sql = `
      SELECT m.*, c.name as crew_member_name,
             v1.name as from_venue_name, v2.name as to_venue_name
      FROM movements m
      JOIN crew_members c ON m.crew_member_id = c.id
      JOIN venues v1 ON m.from_venue_id = v1.id
      JOIN venues v2 ON m.to_venue_id = v2.id
      WHERE m.item_id = ?
      ORDER BY m.logged_at DESC
    `;
    return this.query(sql, [itemId]);
  }

  // Alerts queries
  async getUnreturnedItems(daysOld = 5) {
    const sql = `
      SELECT i.*, e.name as equipment_name,
             c.name as crew_member_name,
             v.name as current_venue_name,
             m.logged_at as checked_out_at,
             CAST((julianday('now') - julianday(m.logged_at)) AS INTEGER) as days_out
      FROM items i
      JOIN equipment e ON i.equipment_id = e.id
      JOIN venues v ON i.current_venue_id = v.id
      JOIN movements m ON i.id = m.item_id AND m.movement_type = 'checkout'
      WHERE i.status = 'checked_out'
        AND m.id = (
          SELECT MAX(id) FROM movements WHERE item_id = i.id
        )
        AND (julianday('now') - julianday(m.logged_at)) >= ?
      ORDER BY m.logged_at ASC
    `;
    return this.query(sql, [daysOld]);
  }

  // Crew queries
  async getCrewMembers(activeOnly = true) {
    let sql = `SELECT * FROM crew_members`;
    const params = [];

    if (activeOnly) {
      sql += ` WHERE is_active = 1`;
    }

    sql += ` ORDER BY name`;
    return this.query(sql, params);
  }

  async getCrewMember(id) {
    const sql = `SELECT * FROM crew_members WHERE id = ?`;
    return this.first(sql, [id]);
  }

  async createCrewMember(name, role = 'crew') {
    const sql = `INSERT INTO crew_members (name, role) VALUES (?, ?)`;
    return this.run(sql, [name, role]);
  }

  async updateCrewMember(id, updates) {
    const fields = [];
    const params = [];

    if (updates.name) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.role) {
      fields.push('role = ?');
      params.push(updates.role);
    }
    if (typeof updates.is_active !== 'undefined') {
      fields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE crew_members SET ${fields.join(', ')} WHERE id = ?`;
    return this.run(sql, params);
  }

  async deleteCrewMember(id) {
    const sql = `DELETE FROM crew_members WHERE id = ?`;
    return this.run(sql, [id]);
  }

  // Venues queries
  async getVenues() {
    const sql = `SELECT * FROM venues ORDER BY name`;
    return this.query(sql);
  }

  async getVenue(id) {
    const sql = `SELECT * FROM venues WHERE id = ?`;
    return this.first(sql, [id]);
  }

  async createVenue(name, description = '') {
    const sql = `INSERT INTO venues (name, description) VALUES (?, ?)`;
    return this.run(sql, [name, description]);
  }

  async updateVenue(id, updates) {
    const fields = [];
    const params = [];

    if (updates.name) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description) {
      fields.push('description = ?');
      params.push(updates.description);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE venues SET ${fields.join(', ')} WHERE id = ?`;
    return this.run(sql, params);
  }

  async deleteVenue(id) {
    const sql = `DELETE FROM venues WHERE id = ?`;
    return this.run(sql, [id]);
  }

  // Equipment queries
  async getEquipment() {
    const sql = `SELECT * FROM equipment ORDER BY category, name`;
    return this.query(sql);
  }

  async getEquipmentByCategory(category) {
    const sql = `SELECT * FROM equipment WHERE category = ? ORDER BY name`;
    return this.query(sql, [category]);
  }
}
