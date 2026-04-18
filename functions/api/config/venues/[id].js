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
      const venue = await db.getVenue(parseInt(id));

      if (!venue) {
        return errorResponse('Venue not found', 404);
      }

      return jsonResponse({ success: true, venue });
    } catch (error) {
      console.error('Error fetching venue:', error);
      return errorResponse('Failed to fetch venue', 500);
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await getJsonBody(request);
      await db.updateVenue(parseInt(id), body);

      return jsonResponse({
        success: true,
        message: 'Venue updated',
      });
    } catch (error) {
      console.error('Error updating venue:', error);
      return errorResponse('Failed to update venue', 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      await db.deleteVenue(parseInt(id));

      return jsonResponse({
        success: true,
        message: 'Venue deleted',
      });
    } catch (error) {
      console.error('Error deleting venue:', error);
      return errorResponse('Failed to delete venue', 500);
    }
  }

  return errorResponse(`Method ${request.method} not allowed`, 405);
}
