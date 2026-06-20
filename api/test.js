// api/test.js - Vercel compatible syntax
import { applyCors } from './_lib/security.js';

export default function handler(req, res) {
  applyCors(req, res, { methods: 'GET, OPTIONS' });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    success: true,
    message: 'Jacal API is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}