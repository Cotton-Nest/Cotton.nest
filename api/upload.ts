import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryConfig } from './cloudinary-sign';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    const { image, media, video, productId, orderId, folder: reqFolder, public_id, resource_type } = body || {};
    const mediaData = media || video || image;

    if (!mediaData || typeof mediaData !== 'string') {
      return res.status(400).json({ error: 'Media data (base64 data URI or URL) is required.' });
    }

    // If it is already a Cloudinary URL or external HTTPS URL, return directly
    if (mediaData.startsWith('https://res.cloudinary.com/') || mediaData.startsWith('http://') || mediaData.startsWith('https://')) {
      return res.status(200).json({
        url: mediaData,
        public_id: public_id || `cotton_nest/external_${Date.now()}`,
        provider: 'cloudinary',
        message: 'Already hosted URL'
      });
    }

    const isVideo =
      resource_type === 'video' ||
      mediaData.startsWith('data:video/') ||
      /\.(mp4|webm|mov|m4v|ogg|ogv)($|\?)/i.test(mediaData);

    const config = getCloudinaryConfig();
    if (!config) {
      return res.status(503).json({
        configured: false,
        error: 'Cloudinary credentials are not configured on the server.',
        help: 'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in your deployment environment variables.',
      });
    }

    const targetFolder =
      typeof reqFolder === 'string' && reqFolder.startsWith('cotton_nest/')
        ? reqFolder
        : orderId
        ? 'cotton_nest/complaints'
        : 'cotton_nest/bedsheets';

    const uploadOptions: any = {
      folder: targetFolder,
      resource_type: isVideo ? 'video' : 'auto',
      overwrite: true,
      tags: [
        'cotton_nest',
        ...(orderId ? ['complaint', `order_${orderId}`] : []),
        productId ? `product_${productId}` : 'general_sheet',
      ],
    };

    if (!isVideo) {
      uploadOptions.transformation = [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ];
    }

    if (public_id) {
      uploadOptions.public_id = public_id;
    } else if (orderId && productId) {
      const safeOrder = String(orderId).replace(/[^a-zA-Z0-9-_]/g, '_');
      const safeProd = String(productId).replace(/[^a-zA-Z0-9-_]/g, '_');
      uploadOptions.public_id = `complaint_${safeOrder}_${safeProd}_${Date.now()}`;
    } else if (productId) {
      const sanitized = productId.replace(/[^a-zA-Z0-9-_]/g, '_');
      uploadOptions.public_id = `sheet_${sanitized}_${Date.now()}`;
    }

    const result = await cloudinary.uploader.upload(mediaData, uploadOptions);

    return res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      resource_type: result.resource_type || (isVideo ? 'video' : 'image'),
      provider: 'cloudinary'
    });
  } catch (err: any) {
    console.error('Cloudinary upload error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload media to Cloudinary.',
    });
  }
}
