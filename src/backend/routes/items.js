// Items API routes

import { jsonResponse, errorResponse } from '../middleware.js';

export async function handleItemsRequest(request, db, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // GET /api/items
  if (pathname === '/api/items' && request.method === 'GET') {
    try {
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

  // GET /api/items/:id
  const itemIdMatch = pathname.match(/^\/api\/items\/(\d+)$/);
  if (itemIdMatch && request.method === 'GET') {
    try {
      const itemId = parseInt(itemIdMatch[1]);
      const item = await db.getItem(itemId);

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

  // GET /api/items/:id/history
  const historyMatch = pathname.match(/^\/api\/items\/(\d+)\/history$/);
  if (historyMatch && request.method === 'GET') {
    try {
      const itemId = parseInt(historyMatch[1]);
      const result = await db.getItemHistory(itemId);

      return jsonResponse({
        success: true,
        count: result.results?.length || 0,
        history: result.results || [],
      });
    } catch (error) {
      console.error('Error fetching item history:', error);
      return errorResponse('Failed to fetch item history', 500);
    }
  }

  return null; // Not handled by this route
}
