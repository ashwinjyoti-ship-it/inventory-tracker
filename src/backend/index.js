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
      const db = new Database(env);

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      let response = null;

      response = await handleItemsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      response = await handleMovementsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      response = await handleAlertsRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      response = await handleConfigRequest(request, db, env);
      if (response) return addCorsHeaders(response, corsHeaders);

      if (pathname === '/health' && request.method === 'GET') {
        return addCorsHeaders(jsonResponse({ status: 'ok' }), corsHeaders);
      }

      return addCorsHeaders(errorResponse('Endpoint not found', 404), corsHeaders);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  // Daily cron: delete movement history older than 30 days for items returned to base
  async scheduled(event, env, ctx) {
    try {
      const db = new Database(env);
      const retentionDays = parseInt(await db.getConfigValue('history_retention_days') || '30');
      const result = await db.deleteExpiredHistory(retentionDays);
      console.log(`History cleanup: removed ${result.meta?.changes || 0} expired movement records`);
    } catch (error) {
      console.error('Scheduled cleanup error:', error);
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
