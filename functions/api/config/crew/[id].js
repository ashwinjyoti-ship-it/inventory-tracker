import { Database } from '../../../db.js';
import { jsonResponse, errorResponse, getJsonBody, checkAdminPassword } from '../../../middleware.js';

export default async function handler(request, env, context) {
  const { id } = context.params;
  const db = new Database(env);

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!checkAdminPassword(env, token)) {
    return errorResponse('Unauthorized', 401);
  }

  if (request.method === 'GET') {
    try {
      const crew = await db.getCrewMember(parseInt(id));

      if (!crew) {
        return errorResponse('Crew member not found', 404);
      }

      return jsonResponse({ success: true, crew });
    } catch (error) {
      console.error('Error fetching crew member:', error);
      return errorResponse('Failed to fetch crew member', 500);
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await getJsonBody(request);
      await db.updateCrewMember(parseInt(id), body);

      return jsonResponse({
        success: true,
        message: 'Crew member updated',
      });
    } catch (error) {
      console.error('Error updating crew member:', error);
      return errorResponse('Failed to update crew member', 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      await db.deleteCrewMember(parseInt(id));

      return jsonResponse({
        success: true,
        message: 'Crew member deleted',
      });
    } catch (error) {
      console.error('Error deleting crew member:', error);
      return errorResponse('Failed to delete crew member', 500);
    }
  }

  return errorResponse(`Method ${request.method} not allowed`, 405);
}
