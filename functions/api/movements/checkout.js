import { Database } from '../../db.js';
import { jsonResponse, errorResponse, getJsonBody } from '../../middleware.js';

export default async function handler(request, env) {
  if (request.method !== 'POST') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const body = await getJsonBody(request);
    const db = new Database(env);

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
