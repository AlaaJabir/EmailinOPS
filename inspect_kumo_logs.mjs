import fetch from 'node-fetch';

async function checkKumoApi() {
  const token = process.env.KUMO_API_TOKEN || '';
  const basicAuth = token ? Buffer.from(token).toString('base64') : '';
  
  const headers = [
    {},
    ...(token ? [{ 'Authorization': `Bearer ${token}` }, { 'Authorization': `Basic ${basicAuth}` }] : [])
  ];

  for (const h of headers) {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/admin/queues', { headers: h, timeout: 2000 });
      console.log('Queues with auth', JSON.stringify(h), 'status:', res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Queues output:', text.slice(0, 300));
        break;
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }
}
checkKumoApi();
