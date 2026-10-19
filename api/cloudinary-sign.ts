import { v2 as cloudinary } from 'cloudinary';

function cleanEnv(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

export function getCloudinaryConfig() {
  let cloudName = cleanEnv(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME);
  let apiKey = cleanEnv(process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY);
  let apiSecret = cleanEnv(process.env.CLOUDINARY_API_SECRET);
  const cloudinaryUrl = cleanEnv(process.env.CLOUDINARY_URL);

  if (cloudinaryUrl) {
    const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
      apiKey = apiKey || cleanEnv(match[1]);
      apiSecret = apiSecret || cleanEnv(match[2]);
      cloudName = cloudName || cleanEnv(match[3]);
    }
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return { cloudName, apiKey, apiSecret };
  }

  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const config = getCloudinaryConfig();
    if (!config || !config.cloudName || !config.apiKey || !config.apiSecret) {
      return res.status(503).json({
        configured: false,
        error: 'Cloudinary credentials are not configured on the server.',
        help: 'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in your deployment environment variables.',
      });
    }

    let urlSearchParams: URLSearchParams | null = null;
    try {
      if (req.url) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        urlSearchParams = parsedUrl.searchParams;
      }
    } catch {}

    const query = req.query || {};
    let body = {};
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch {}
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    }

    const productId = (
      query.productId ||
      urlSearchParams?.get('productId') ||
      (body as any).productId ||
      ''
    ).trim();

    const explicitPublicId = (
      query.public_id ||
      urlSearchParams?.get('public_id') ||
      (body as any).public_id ||
      ''
    ).trim();

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'cotton_nest/bedsheets';

    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
    };

    let assignedPublicId: string | undefined;
    if (explicitPublicId) {
      assignedPublicId = explicitPublicId;
      paramsToSign.public_id = assignedPublicId;
    } else if (productId) {
      const sanitizedId = productId.replace(/[^a-zA-Z0-9-_]/g, '_');
      assignedPublicId = `sheet_${sanitizedId}_${timestamp}`;
      paramsToSign.public_id = assignedPublicId;
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, config.apiSecret);

    return res.status(200).json({
      configured: true,
      timestamp,
      signature,
      apiKey: config.apiKey,
      cloudName: config.cloudName,
      folder,
      public_id: assignedPublicId,
    });
  } catch (err: any) {
    console.error('Failed to generate Cloudinary signature:', err);
    return res.status(500).json({
      configured: false,
      error: err.message || 'Failed to sign Cloudinary upload request.',
    });
  }
}
