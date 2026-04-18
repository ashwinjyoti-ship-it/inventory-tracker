// Configuration (Admin) API routes

import { jsonResponse, errorResponse, getJsonBody, checkAdminPassword } from '../middleware.js';

async function requireAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!checkAdminPassword(env, token)) {
    return { authorized: false, response: errorResponse('Unauthorized', 401) };
  }

  return { authorized: true };
}

export async function handleConfigRequest(request, db, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Venues endpoints
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
    const auth = await requireAdmin(request, env);
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
    const auth = await requireAdmin(request, env);
    if (!auth.authorized) return auth.response;

    try {
      const venueId = parseInt(venueIdMatch[1]);
      const body = await getJsonBody(request);

      const result = await db.updateVenue(venueId, body);

      return jsonResponse({
        success: true,
        message: 'Venue updated',
      });
    } catch (error) {
      console.error('Error updating venue:', error);
      return errorResponse('Failed to update venue', 500);
    }
  }

  // DELETE /api/config/venues/:id
  if (venueIdMatch && request.method === 'DELETE') {
    const auth = await requireAdmin(request, env);
    if (!auth.authorized) return auth.response;

    try {
      const venueId = parseInt(venueIdMatch[1]);
      await db.deleteVenue(venueId);

      return jsonResponse({
        success: true,
        message: 'Venue deleted',
      });
    } catch (error) {
      console.error('Error deleting venue:', error);
      return errorResponse('Failed to delete venue', 500);
    }
  }

  // Crew endpoints
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
    const auth = await requireAdmin(request, env);
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
    const auth = await requireAdmin(request, env);
    if (!auth.authorized) return auth.response;

    try {
      const crewId = parseInt(crewIdMatch[1]);
      const body = await getJsonBody(request);

      const result = await db.updateCrewMember(crewId, body);

      return jsonResponse({
        success: true,
        message: 'Crew member updated',
      });
    } catch (error) {
      console.error('Error updating crew member:', error);
      return errorResponse('Failed to update crew member', 500);
    }
  }

  // DELETE /api/config/crew/:id
  if (crewIdMatch && request.method === 'DELETE') {
    const auth = await requireAdmin(request, env);
    if (!auth.authorized) return auth.response;

    try {
      const crewId = parseInt(crewIdMatch[1]);
      await db.deleteCrewMember(crewId);

      return jsonResponse({
        success: true,
        message: 'Crew member deleted',
      });
    } catch (error) {
      console.error('Error deleting crew member:', error);
      return errorResponse('Failed to delete crew member', 500);
    }
  }

  return null; // Not handled by this route
}
