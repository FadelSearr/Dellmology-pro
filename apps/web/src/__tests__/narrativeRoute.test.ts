import request from 'supertest';
import app from '@/app'; // assuming Next.js testing server isn't setup; if not, skip

// This is a placeholder; actual nextjs API tests may require jest-edge or similar.
// We'll instead check the function directly by importing the route handler.

import { POST } from '@/app/api/narrative/route';

describe('Narrative API', () => {
  it('returns 200 with default message when data empty', async () => {
    const req: any = {
      json: async () => ({ type: 'broker', symbol: 'TEST', data: {} }),
    };
    const res = await POST(req as Request);
    const json = await res.json();
    expect(res instanceof Response).toBe(true);
    expect(json.narrative).toMatch(/narasi/i);
  });
});
