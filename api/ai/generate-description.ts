import {
  generateProductDescription,
  type GenerateDescriptionPayload
} from '../ai-description';

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const payload =
      (req.body || {}) as GenerateDescriptionPayload;

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid description request.'
      });
    }

    const result = await generateProductDescription(payload);

    return res.status(200).json(result);

  } catch (error) {
    console.error('AI description endpoint failed:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Description generation failed.';

    return res.status(500).json({
      success: false,
      error: message
    });
  }
}