// Middleware and utilities

export function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function checkAdminPassword(env, password) {
  const adminPassword = env.ADMIN_PASSWORD || 'change-me-in-production';
  return password === adminPassword;
}

export async function validateRequest(request, method) {
  if (request.method !== method) {
    return { valid: false, response: errorResponse(`Method ${request.method} not allowed`, 405) };
  }
  return { valid: true };
}

export async function getJsonBody(request) {
  try {
    const text = await request.text();
    return parseJson(text);
  } catch (error) {
    return null;
  }
}
