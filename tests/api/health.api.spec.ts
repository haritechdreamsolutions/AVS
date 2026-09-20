import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../fixtures/auth.fixtures.js';

test.describe('Health API Verification', () => {
  test('GET /health returns 200 OK and live database status', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('database', 'connected');
    expect(body).toHaveProperty('driver', 'pg');
    expect(body).toHaveProperty('time');
  });

  test('GET /api/health returns valid health check response', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });
});
