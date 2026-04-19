// Alerts API routes

import { jsonResponse, errorResponse } from '../middleware.js';

export async function handleAlertsRequest(request, db, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // GET /api/alerts/unreturned
  if (pathname === '/api/alerts/unreturned' && request.method === 'GET') {
    try {
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

  return null;
}
