export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    method: req.method,
    headers: req.headers,
    bodyType: typeof req.body,
    body: req.body,
    bodyString: req.body ? req.body.toString() : null,
    bodyLength: req.body ? String(req.body).length : 0
  });
}