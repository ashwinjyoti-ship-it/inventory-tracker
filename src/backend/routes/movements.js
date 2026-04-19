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
        const item = await db.getItem(itemId);
        if (!item) {
          return errorResponse(`Item ${itemId} not found`, 404);
        }

        const result = await db.createMovement(
          itemId,
          body.crew_member_id,
          body.from_venue_id,
          body.to_venue_id,
          'checkout',
          body.notes || ''
        );

        // Update item location and mark as checked_out
        await db.updateItemForCheckout(itemId, body.to_venue_id);

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

  // POST /api/movements/return — returns items to their home venue
  if (pathname === '/api/movements/return' && request.method === 'POST') {
    try {
      const body = await getJsonBody(request);

      if (!body || !body.item_ids || !Array.isArray(body.item_ids) || body.item_ids.length === 0) {
        return errorResponse('Invalid request: item_ids array required', 400);
      }

      if (!body.crew_member_id) {
        return errorResponse('Invalid request: crew_member_id required', 400);
      }

      const movements = [];

      for (const itemId of body.item_ids) {
        const item = await db.getItem(itemId);
        if (!item) {
          return errorResponse(`Item ${itemId} not found`, 404);
        }

        // Each item returns to its own home venue
        const toVenueId = item.home_venue_id;

        const result = await db.createMovement(
          itemId,
          body.crew_member_id,
          item.current_venue_id,
          toVenueId,
          'return',
          body.notes || ''
        );

        await db.updateItemLocation(itemId, toVenueId);

        // Stamp all open movements so they expire in 30 days
        await db.markReturnedToBase(itemId);

        movements.push({
          item_id: itemId,
          movement_id: result.meta.last_row_id,
          to_venue_id: toVenueId,
        });
      }

      return jsonResponse({
        success: true,
        message: `${movements.length} item(s) returned to base`,
        movements,
      }, 201);
    } catch (error) {
      console.error('Error creating return:', error);
      return errorResponse('Failed to create return', 500);
    }
  }

  // POST /api/movements/move — moves items to another venue (not home, stays checked_out)
  if (pathname === '/api/movements/move' && request.method === 'POST') {
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
        const item = await db.getItem(itemId);
        if (!item) {
          return errorResponse(`Item ${itemId} not found`, 404);
        }

        const result = await db.createMovement(
          itemId,
          body.crew_member_id,
          item.current_venue_id,
          body.to_venue_id,
          'move',
          body.notes || ''
        );

        // Item stays checked_out but location updates
        await db.updateItemForCheckout(itemId, body.to_venue_id);

        movements.push({
          item_id: itemId,
          movement_id: result.meta.last_row_id,
        });
      }

      return jsonResponse({
        success: true,
        message: `${movements.length} item(s) moved`,
        movements,
      }, 201);
    } catch (error) {
      console.error('Error creating move:', error);
      return errorResponse('Failed to move items', 500);
    }
  }

  // GET /api/movements
  if (pathname === '/api/movements' && request.method === 'GET') {
    try {
      const crew      = url.searchParams.get('crew_member_id');
      const item      = url.searchParams.get('item_id');
      const type      = url.searchParams.get('type');
      const from_date = url.searchParams.get('from_date');
      const to_date   = url.searchParams.get('to_date');

      const filters = {};
      if (crew)      filters.crew_member_id = parseInt(crew);
      if (item)      filters.item_id = parseInt(item);
      if (type)      filters.movement_type = type;
      if (from_date) filters.from_date = from_date;
      if (to_date)   filters.to_date = to_date;

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

  return null;
}
