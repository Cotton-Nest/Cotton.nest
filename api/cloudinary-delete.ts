import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryConfig } from './cloudinary-sign.ts';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { public_id } = body || {};
    if (!public_id || typeof public_id !== 'string') {
      return res.status(400).json({ error: 'public_id is required' });
    }

    // Security check: only allow deletion within the cotton_nest folder to prevent accidental cross-project deletions
    if (!public_id.includes('cotton_nest') && !public_id.startsWith('sheet_')) {
      return res.status(403).json({ error: 'Cannot delete assets outside store folder' });
    }

    const config = getCloudinaryConfig();
    if (!config) {
      return res.status(503).json({ error: 'Cloudinary not configured on server' });
    }

    const result = await cloudinary.uploader.destroy(public_id);
    return res.status(200).json({ success: true, result });
  } catch (err: any) {
    console.error('Failed to delete Cloudinary asset:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete asset' });
  }
}
