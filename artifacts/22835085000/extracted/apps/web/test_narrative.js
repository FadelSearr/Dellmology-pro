// quick script to POST to local narrative API
import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'broker', symbol: 'BBCA', data: {} })
    });
    console.log('status', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error('error', err);
  }
})();
