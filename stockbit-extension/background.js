// The backend endpoint where the token will be sent.
const UPDATE_TOKEN_ENDPOINT = 'http://localhost:3000/api/update-token';

console.log('Dellmology Auth Helper: Service worker starting...');
console.log('Target API URL:', UPDATE_TOKEN_ENDPOINT);

let lastSyncedToken = null;

/**
 * Decodes a JWT token to extract its payload, including the expiration time.
 * @param {string} token The JWT token.
 * @returns {object|null} The decoded payload or null if decoding fails.
 */
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Dellmology Auth Helper: Failed to decode JWT', e);
    return null;
  }
}

/**
 * Sends the captured token to the Dellmology backend.
 * @param {string} token The bearer token.
 * @param {number} expiresAt The expiration timestamp (seconds).
 */
function sendTokenToBackend(token, expiresAt) {
  const expires_at = expiresAt ? new Date(expiresAt * 1000).toISOString() : null;

  const payload = {
    token: token,
    expires_at: expires_at,
  };

  fetch(UPDATE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (response.ok) {
        console.log('Dellmology Auth Helper: Token successfully synced to backend.');
        lastSyncedToken = token; // Update cache on success
      } else {
        console.error('Dellmology Auth Helper: Failed to sync token. Status:', response.status);
      }
    })
    .catch((error) => {
      console.error('Dellmology Auth Helper: Error syncing token:', error);
    });
}

console.log('Registering webRequest listener...');

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    console.log('Dellmology Auth Helper: Checking request:', details.url);

    // Find the 'Authorization' header in the request.
    const authHeader = details.requestHeaders.find(
      (header) => header.name.toLowerCase() === 'authorization'
    );

    if (authHeader && authHeader.value && authHeader.value.startsWith('Bearer ')) {
      // Extract the token string by removing "Bearer ".
      const token = authHeader.value.substring(7);

      // Only sync if the token has changed to avoid spamming the API
      if (token !== lastSyncedToken) {
        console.log('Dellmology Auth Helper: New token candidate detected...');

        const decoded = decodeJwt(token);

        // Only sync if it's a valid JWT (must have a payload with an expiry)
        if (!decoded || !decoded.exp) {
          console.log('Dellmology Auth Helper: Skipping non-JWT or invalid token.');
          return;
        }

        console.log('Dellmology Auth Helper: Valid JWT detected from:', details.url);
        console.log('Dellmology Auth Helper: Token expiry:', new Date(decoded.exp * 1000));
        sendTokenToBackend(token, decoded.exp);
      }
    }
  },
  // Filter for requests to Stockbit API endpoints.
  { urls: ['https://*.stockbit.com/*'] },
  // We need 'requestHeaders' and 'extraHeaders' to read the headers.
  ['requestHeaders', 'extraHeaders']
);

console.log('Dellmology Auth Helper: Service worker started.');
