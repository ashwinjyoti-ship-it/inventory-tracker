import { Database } from '../../../db.js';
import { jsonResponse, errorResponse } from '../../../middleware.js';

export default async function handler(request, env, context) {
  const { id } = context.params;

  if (request.method !== 'GET') {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  try {
    const db = new Database(env);
    const result = await db.getItemHistory(parseInt(id));

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
