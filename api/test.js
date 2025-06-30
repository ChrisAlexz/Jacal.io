// api/test.js - Vercel compatible syntax
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).json({
    success: true,
    message: 'Jacal API is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}