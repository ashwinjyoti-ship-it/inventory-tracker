// Configuration (Admin) API routes

import { jsonResponse, errorResponse, getJsonBody } from '../middleware.js';

async function requireAdmin(request, db) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const adminPassword = await db.getAdminPassword();

  if (token !== adminPassword) {
    return { authorized: false, response: errorResponse('Unauthorized', 401) };
  }

  return { authorized: true };
}

export async function handleConfigRequest(request, db, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // GET /api/config/venues
  if (pathname === '/api/config/venues' && request.method === 'GET') {
    try {
      const result = await db.getVenues();
      return jsonResponse({
        success: true,
        count: result.results?.length || 0,
        venues: result.results || [],
      });
    } catch (error) {
      console.error('Error fetching venues:', error);
      return errorResponse('Failed to fetch venues', 500);
    }
  }

  // GET /api/config/venues/:id
  const venueIdMatch = pathname.match(/^\/api\/config\/venues\/(\d+)$/);
  if (venueIdMatch && request.method === 'GET') {
    try {
      const venueId = parseInt(venueIdMatch[1]);
      const venue = await db.getVenue(venueId);

      if (!venue) {
        return errorResponse('Venue not found', 404);
      }

      return jsonResponse({ success: true, venue });
    } catch (error) {
      console.error('Error fetching venue:', error);
      return errorResponse('Failed to fetch venue', 500);
    }
  }

  // POST /api/config/venues
  if (pathname === '/api/config/venues' && request.method === 'POST') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);

      if (!body || !body.name) {
        return errorResponse('Invalid request: name required', 400);
      }

      const result = await db.createVenue(body.name, body.description || '');

      return jsonResponse({
        success: true,
        message: 'Venue created',
        venue_id: result.meta.last_row_id,
      }, 201);
    } catch (error) {
      console.error('Error creating venue:', error);
      return errorResponse('Failed to create venue', 500);
    }
  }

  // PUT /api/config/venues/:id
  if (venueIdMatch && request.method === 'PUT') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const venueId = parseInt(venueIdMatch[1]);
      const body = await getJsonBody(request);

      await db.updateVenue(venueId, body);

      return jsonResponse({ success: true, message: 'Venue updated' });
    } catch (error) {
      console.error('Error updating venue:', error);
      return errorResponse('Failed to update venue', 500);
    }
  }

  // DELETE /api/config/venues/:id
  if (venueIdMatch && request.method === 'DELETE') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const venueId = parseInt(venueIdMatch[1]);

      // Prevent deleting a venue that has items currently there
      const items = await db.getItems({ current_venue_id: venueId, include_under_repair: true });
      if (items.results && items.results.length > 0) {
        return errorResponse('Cannot delete venue: items are currently located there', 409);
      }

      await db.deleteVenue(venueId);

      return jsonResponse({ success: true, message: 'Venue deleted' });
    } catch (error) {
      console.error('Error deleting venue:', error);
      return errorResponse('Failed to delete venue', 500);
    }
  }

  // GET /api/config/crew
  if (pathname === '/api/config/crew' && request.method === 'GET') {
    try {
      const result = await db.getCrewMembers();
      return jsonResponse({
        success: true,
        count: result.results?.length || 0,
        crew: result.results || [],
      });
    } catch (error) {
      console.error('Error fetching crew:', error);
      return errorResponse('Failed to fetch crew', 500);
    }
  }

  // GET /api/config/crew/:id
  const crewIdMatch = pathname.match(/^\/api\/config\/crew\/(\d+)$/);
  if (crewIdMatch && request.method === 'GET') {
    try {
      const crewId = parseInt(crewIdMatch[1]);
      const crew = await db.getCrewMember(crewId);

      if (!crew) {
        return errorResponse('Crew member not found', 404);
      }

      return jsonResponse({ success: true, crew });
    } catch (error) {
      console.error('Error fetching crew member:', error);
      return errorResponse('Failed to fetch crew member', 500);
    }
  }

  // POST /api/config/crew
  if (pathname === '/api/config/crew' && request.method === 'POST') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);

      if (!body || !body.name) {
        return errorResponse('Invalid request: name required', 400);
      }

      const result = await db.createCrewMember(body.name, body.role || 'crew');

      return jsonResponse({
        success: true,
        message: 'Crew member created',
        crew_id: result.meta.last_row_id,
      }, 201);
    } catch (error) {
      console.error('Error creating crew member:', error);
      return errorResponse('Failed to create crew member', 500);
    }
  }

  // PUT /api/config/crew/:id
  if (crewIdMatch && request.method === 'PUT') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const crewId = parseInt(crewIdMatch[1]);
      const body = await getJsonBody(request);

      await db.updateCrewMember(crewId, body);

      return jsonResponse({ success: true, message: 'Crew member updated' });
    } catch (error) {
      console.error('Error updating crew member:', error);
      return errorResponse('Failed to update crew member', 500);
    }
  }

  // DELETE /api/config/crew/:id
  if (crewIdMatch && request.method === 'DELETE') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const crewId = parseInt(crewIdMatch[1]);
      await db.deleteCrewMember(crewId);

      return jsonResponse({ success: true, message: 'Crew member deleted' });
    } catch (error) {
      console.error('Error deleting crew member:', error);
      return errorResponse('Failed to delete crew member', 500);
    }
  }

  // PUT /api/config/password — change admin password (must be logged in with current password)
  if (pathname === '/api/config/password' && request.method === 'PUT') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);

      if (!body || !body.new_password) {
        return errorResponse('new_password required', 400);
      }

      if (body.new_password.length < 4) {
        return errorResponse('Password must be at least 4 characters', 400);
      }

      await db.updateAdminPassword(body.new_password);

      return jsonResponse({ success: true, message: 'Password updated' });
    } catch (error) {
      console.error('Error updating password:', error);
      return errorResponse('Failed to update password', 500);
    }
  }

  // DELETE /api/config/history — wipe all movement records and reset item locations
  if (pathname === '/api/config/history' && request.method === 'DELETE') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      await db.clearAllHistory();
      return jsonResponse({ success: true, message: 'All history cleared and items reset' });
    } catch (error) {
      console.error('Error clearing history:', error);
      return errorResponse('Failed to clear history', 500);
    }
  }

  // GET /api/config/equipment — list all equipment types (public, used to populate dropdowns)
  if (pathname === '/api/config/equipment' && request.method === 'GET') {
    try {
      const result = await db.getEquipment();
      return jsonResponse({ success: true, equipment: result.results || [] });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      return errorResponse('Failed to fetch equipment', 500);
    }
  }

  // POST /api/config/equipment — create new equipment type
  if (pathname === '/api/config/equipment' && request.method === 'POST') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);
      if (!body?.name?.trim() || !body?.category?.trim())
        return errorResponse('name and category required', 400);
      const result = await db.createEquipment(body.name.trim(), body.category.trim());
      return jsonResponse({ success: true, equipment_id: result.meta.last_row_id }, 201);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed'))
        return errorResponse('Equipment type with that name already exists', 409);
      console.error('Error creating equipment:', error);
      return errorResponse('Failed to create equipment type', 500);
    }
  }

  // POST /api/config/items — add items to an equipment type
  if (pathname === '/api/config/items' && request.method === 'POST') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);
      const quantity = parseInt(body?.quantity);
      if (!body?.equipment_id || !body?.home_venue_id || !quantity)
        return errorResponse('equipment_id, home_venue_id, quantity required', 400);
      if (isNaN(quantity) || quantity < 1 || quantity > 100)
        return errorResponse('quantity must be 1–100', 400);
      await db.addItems(parseInt(body.equipment_id), parseInt(body.home_venue_id), quantity);
      return jsonResponse({ success: true, message: `${quantity} item(s) added` }, 201);
    } catch (error) {
      console.error('Error adding items:', error);
      return errorResponse('Failed to add items', 500);
    }
  }

  // DELETE /api/config/items/:id — retire item (soft delete)
  const retireItemMatch = pathname.match(/^\/api\/config\/items\/(\d+)$/);
  if (retireItemMatch && request.method === 'DELETE') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const item = await db.getItem(parseInt(retireItemMatch[1]));
      if (!item) return errorResponse('Item not found', 404);
      await db.retireItem(item.id);
      return jsonResponse({ success: true, was_checked_out: item.status === 'checked_out' });
    } catch (error) {
      console.error('Error retiring item:', error);
      return errorResponse('Failed to retire item', 500);
    }
  }

  // GET /api/config/repairs — items currently under repair
  if (pathname === '/api/config/repairs' && request.method === 'GET') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const result = await db.getItemsUnderRepair();
      return jsonResponse({ success: true, repairs: result.results || [] });
    } catch (error) {
      console.error('Error fetching repair items:', error);
      return errorResponse('Failed to fetch repair items', 500);
    }
  }

  // GET /api/config/repairs/history — completed repair records
  if (pathname === '/api/config/repairs/history' && request.method === 'GET') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const result = await db.getRepairHistory();
      return jsonResponse({ success: true, history: result.results || [] });
    } catch (error) {
      console.error('Error fetching repair history:', error);
      return errorResponse('Failed to fetch repair history', 500);
    }
  }

  // POST /api/config/repairs — send item to repair
  if (pathname === '/api/config/repairs' && request.method === 'POST') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);
      if (!body?.item_id) return errorResponse('item_id required', 400);
      const item = await db.getItem(parseInt(body.item_id));
      if (!item) return errorResponse('Item not found', 404);
      if (item.status !== 'available') return errorResponse('Only available items can be sent for repair', 409);
      await db.sendToRepair(parseInt(body.item_id), body.notes || '');
      return jsonResponse({ success: true, message: 'Item sent for repair' }, 201);
    } catch (error) {
      console.error('Error sending item for repair:', error);
      return errorResponse('Failed to send item for repair', 500);
    }
  }

  // PUT /api/config/repairs/:id — return item from repair
  const repairIdMatch = pathname.match(/^\/api\/config\/repairs\/(\d+)$/);
  if (repairIdMatch && request.method === 'PUT') {
    const auth = await requireAdmin(request, db);
    if (!auth.authorized) return auth.response;

    try {
      const body = await getJsonBody(request);
      const result = await db.returnFromRepair(parseInt(repairIdMatch[1]), body?.notes || '');
      if (!result) return errorResponse('Repair record not found', 404);
      return jsonResponse({ success: true, message: 'Item returned from repair' });
    } catch (error) {
      console.error('Error returning item from repair:', error);
      return errorResponse('Failed to return item from repair', 500);
    }
  }

  return null;
}
