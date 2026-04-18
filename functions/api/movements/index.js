import { Database } from '../../db.js';
import { jsonResponse, errorResponse } from '../../middleware.js';

export default async function handler(request, env) {
  if (request.method !== 'GET') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const db = new Database(env);
    const url = new URL(request.url);
    const crew = url.searchParams.get('crew_member_id');
    const item = url.searchParams.get('item_id');
    const type = url.searchParams.get('type');

    const filters = {};
    if (crew) filters.crew_member_id = parseInt(crew);
    if (item) filters.item_id = parseInt(item);
    if (type) filters.movement_type = type;

    const result = await db.getMovements(filters);

    return jsonResponse({
      success: true,
      count: result.results?.length || 0,
      movements: result.results || [],
    });
  } catch (error) {
    console.error('Error fetching movements:', error);
    return errorResponse('Failed to fetch movements', 500);
  }
}
