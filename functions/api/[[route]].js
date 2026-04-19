// Cloudflare Pages Function — catches all /api/* requests
import { Database } from '../../src/backend/db.js';
import { jsonResponse, errorResponse } from '../../src/backend/middleware.js';
import { handleItemsRequest } from '../../src/backend/routes/items.js';
import { handleMovementsRequest } from '../../src/backend/routes/movements.js';
import { handleAlertsRequest } from '../../src/backend/routes/alerts.js';
import { handleConfigRequest } from '../../src/backend/routes/config.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const db = new Database(env);
    let response = null;

    response = await handleItemsRequest(request, db, env);
    if (response) return addCors(response);

    response = await handleMovementsRequest(request, db, env);
    if (response) return addCors(response);

    response = await handleAlertsRequest(request, db, env);
    if (response) return addCors(response);

    response = await handleConfigRequest(request, db, env);
    if (response) return addCors(response);

    return addCors(errorResponse('Endpoint not found', 404));
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

function addCors(response) {
  const r = new Response(response.body, response);
  Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}
