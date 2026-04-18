import { Database } from '../../../db.js';
import { jsonResponse, errorResponse, getJsonBody, checkAdminPassword } from '../../../middleware.js';

export default async function handler(request, env) {
  const db = new Database(env);

  if (request.method === 'GET') {
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

  return errorResponse(`Method ${request.method} not allowed`, 405);
}
