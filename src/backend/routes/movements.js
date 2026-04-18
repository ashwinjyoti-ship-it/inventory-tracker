// Movements (Checkout/Return) API routes

import { jsonResponse, errorResponse, getJsonBody } from '../middleware.js';

export async function handleMovementsRequest(request, db, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // POST /api/movements/checkout
  if (pathname === '/api/movements/checkout' && request.method === 'POST') {
    try {
      const body = await getJsonBody(request);

      if (!body || !body.item_ids || !Array.isArray(body.item_ids) || body.item_ids.length === 0) {
        return errorResponse('Invalid request: item_ids array required', 400);
      }

      if (!body.crew_member_id || !body.from_venue_id || !body.to_venue_id) {
        return errorResponse('Invalid request: crew_member_id, from_venue_id, to_venue_id required', 400);
      }

      const movements = [];

      for (const itemId of body.item_ids) {
        // Verify item exists
        const item = await db.getItem(itemId);
        if (!item) {
          return errorResponse(`Item ${itemId} not found`, 404);
        }

        // Create movement record
        const result = await db.createMovement(
          itemId,
          body.crew_member_id,
          body.from_venue_id,
          body.to_venue_id,
          'checkout',
          body.notes || ''
        );

        // Update item status
        await db.updateItemStatus(itemId, 'checked_out');

        movements.push({
          item_id: itemId,
          movement_id: result.meta.last_row_id,
        });
      }

      return jsonResponse({
        success: true,
        message: `${movements.length} item(s) checked out`,
        movements,
      }, 201);
    } catch (error) {
      console.error('Error creating checkout:', error);
      return errorResponse('Failed to create checkout', 500);
    }
  }

  // POST /api/movements/return
  if (pathname === '/api/movements/return' && request.method === 'POST') {
    try {
      const body = await getJsonBody(request);

      if (!body || !body.item_ids || !Array.isArray(body.item_ids) || body.item_ids.length === 0) {
        return errorResponse('Invalid request: item_ids array required', 400);
      }

      if (!body.crew_member_id || !body.to_venue_id) {
        return errorResponse('Invalid request: crew_member_id, to_venue_id required', 400);
      }

      const movements = [];

      for (const itemId of body.item_ids) {
        // Verify item exists and is checked out
        const item = await db.getItem(itemId);
        if (!item) {
          return errorResponse(`Item ${itemId} not found`, 404);
        }

        if (item.status !== 'checked_out') {
          return errorResponse(`Item ${itemId} is not checked out`, 400);
        }

        // Get previous movement to know from_venue
        const prevMovements = await db.getItemHistory(itemId);
        const prevCheckout = prevMovements.results?.find(m => m.movement_type === 'checkout');

        if (!prevCheckout) {
          return errorResponse(`No checkout found for item ${itemId}`, 400);
        }

        // Create return movement
        const result = await db.createMovement(
          itemId,
          body.crew_member_id,
          item.current_venue_id, // from current location
          body.to_venue_id,
          'return',
          body.notes || ''
        );

        // Update item location and status
        await db.updateItemLocation(itemId, body.to_venue_id);

        movements.push({
          item_id: itemId,
          movement_id: result.meta.last_row_id,
        });
      }

      return jsonResponse({
        success: true,
        message: `${movements.length} item(s) returned`,
        movements,
      }, 201);
    } catch (error) {
      console.error('Error creating return:', error);
      return errorResponse('Failed to create return', 500);
    }
  }

  // GET /api/movements
  if (pathname === '/api/movements' && request.method === 'GET') {
    try {
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

  return null; // Not handled by this route
}
