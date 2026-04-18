import { Database } from '../db.js';
import { jsonResponse, errorResponse } from '../middleware.js';

export default async function handler(request, env) {
  if (request.method !== 'GET') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const db = new Database(env);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const venue = url.searchParams.get('venue');
    const equipment = url.searchParams.get('equipment');

    const filters = {};
    if (status) filters.status = status;
    if (venue) filters.current_venue_id = parseInt(venue);
    if (equipment) filters.equipment_id = parseInt(equipment);

    const result = await db.getItems(filters);

    return jsonResponse({
      success: true,
      count: result.results?.length || 0,
      items: result.results || [],
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return errorResponse('Failed to fetch items', 500);
  }
}
