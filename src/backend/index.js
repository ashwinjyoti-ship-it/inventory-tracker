// Cloudflare Worker Entry Point - Sound Inventory Tracker API

import { Database } from './db.js';
import { jsonResponse, errorResponse } from './middleware.js';
import { handleItemsRequest } from './routes/items.js';
import { handleMovementsRequest } from './routes/movements.js';
import { handleAlertsRequest } from './routes/alerts.js';
import { handleConfigRequest } from './routes/config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // Initialize database
      const db = new Database(env);

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      // Route requests
      let response = null;

      // Items routes
      response = await handleItemsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      // Movements routes
      response = await handleMovementsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      // Alerts routes
      response = await handleAlertsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      // Config (admin) routes
      response = await handleConfigRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        return addCorsHeaders(jsonResponse({ status: 'ok' }), corsHeaders);
      }

      // 404
      return addCorsHeaders(errorResponse('Endpoint not found', 404), corsHeaders);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

function addCorsHeaders(response, headers) {
  const newResponse = new Response(response.body, response);
  Object.entries(headers).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}
