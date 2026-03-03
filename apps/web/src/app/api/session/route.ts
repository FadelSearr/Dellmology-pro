import { db } from '@/lib/db';
import { decryptSessionToken } from '@/lib/security/sessionTokenCrypto';
import { NextResponse } from 'next/server';

// Ensure the API is not cached
export const dynamic = 'force-dynamic'; 

/**
 * GET /api/session
 * Retrieves the latest session token from the database.
 * This endpoint is called by the Go data streamer to authenticate with the WebSocket service.
 */
export async function GET() {
  try {
    const result = await db.query(
      "SELECT value, expires_at FROM config WHERE key = 'session_token' ORDER BY updated_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session token not found.' }, { status: 404 });
    }

    const tokenData = result.rows[0];

    // Optional: Check if the token is expired
    if (tokenData.expires_at) {
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: 'Session token is expired.' }, { status: 410 }); // 410 Gone
      }
    }

    const decryptedToken = decryptSessionToken(tokenData.value);
    return NextResponse.json({ token: decryptedToken });

  } catch (error) {
    console.error('Error fetching session token:', error);
    // Provide a more detailed error message in the logs, but a generic one to the client.
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
