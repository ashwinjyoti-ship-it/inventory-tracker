import { Database } from '../../db.js';
import { jsonResponse, errorResponse } from '../../middleware.js';

export default async function handler(request, env, context) {
  const { id } = context.params;

  if (request.method !== 'GET') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const db = new Database(env);
    const item = await db.getItem(parseInt(id));

    if (!item) {
      return errorResponse('Item not found', 404);
    }

    return jsonResponse({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    return errorResponse('Failed to fetch item', 500);
  }
}
