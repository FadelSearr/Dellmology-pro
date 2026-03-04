import { db } from '@/lib/db';
import { decryptSessionToken, isEncryptedSessionToken } from '@/lib/security/sessionTokenCrypto';
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
      "SELECT value, expires_at, updated_at FROM config WHERE key = 'session_token' ORDER BY updated_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          token: null,
          available: false,
          reason: 'Session token not found',
          retry_after_seconds: 15,
        },
        { status: 200 },
      );
    }

    const tokenData = result.rows[0];

    if (typeof tokenData.value !== 'string' || !isEncryptedSessionToken(tokenData.value)) {
      await db.query(
        "DELETE FROM config WHERE key = 'session_token'",
      );

      return NextResponse.json(
        {
          token: null,
          available: false,
          reason: 'Session token rejected: unencrypted format',
          retry_after_seconds: 15,
        },
        { status: 200 },
      );
    }

    // Optional: Check if the token is expired
    if (tokenData.expires_at) {
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          {
            token: null,
            available: false,
            reason: 'Session token is expired',
            retry_after_seconds: 15,
            expires_at: tokenData.expires_at,
            updated_at: tokenData.updated_at,
          },
          { status: 200 },
        );
      }
    }

    const decryptedToken = decryptSessionToken(tokenData.value);
    return NextResponse.json({
      token: decryptedToken,
      available: true,
      retry_after_seconds: 0,
      expires_at: tokenData.expires_at,
      updated_at: tokenData.updated_at,
    });

  } catch (error) {
    console.error('Error fetching session token:', error);
    // Provide a more detailed error message in the logs, but a generic one to the client.
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
