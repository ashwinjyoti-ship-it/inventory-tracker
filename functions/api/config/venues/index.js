import { Database } from '../../../db.js';
import { jsonResponse, errorResponse, getJsonBody, checkAdminPassword } from '../../../middleware.js';

export default async function handler(request, env) {
  const db = new Database(env);

  if (request.method === 'GET') {
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

  if (request.method === 'POST') {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!checkAdminPassword(env, token)) {
      return errorResponse('Unauthorized', 401);
    }

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

  return errorResponse(`Method ${request.method} not allowed`, 405);
}
