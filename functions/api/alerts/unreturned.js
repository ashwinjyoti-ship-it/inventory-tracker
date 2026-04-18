import { Database } from '../../db.js';
import { jsonResponse, errorResponse } from '../../middleware.js';

export default async function handler(request, env) {
  if (request.method !== 'GET') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const db = new Database(env);
    const url = new URL(request.url);
    const daysOld = parseInt(url.searchParams.get('days')) || 5;

    const result = await db.getUnreturnedItems(daysOld);

    return jsonResponse({
      success: true,
      alert_threshold_days: daysOld,
      count: result.results?.length || 0,
      unreturned_items: result.results || [],
    });
  } catch (error) {
    console.error('Error fetching unreturned items:', error);
    return errorResponse('Failed to fetch unreturned items', 500);
  }
}
