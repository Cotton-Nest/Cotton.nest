import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryConfig } from './api/cloudinary-sign.ts';
import { BEDSHEETS_CATALOG } from './src/data/products.ts';
import { INITIAL_ORDERS } from './src/data/orders.ts';
import { INITIAL_SITE_CONTENT } from './src/data/siteContent.ts';
import { INITIAL_REVIEWS } from './src/data/reviews.ts';
import { INITIAL_SEASONAL_CONFIG } from './src/data/seasonal.ts';
import { INITIAL_COUPONS, CouponOffer } from './src/data/coupons.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Persistent Database Directory & File
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store_db.json');

interface StoreDatabase {
  products: any[];
  orders: any[];
  siteContent: any;
  theme?: any;
  reviews?: any[];
  seasonalConfig?: any;
  coupons?: CouponOffer[];
}

function initDatabase(): StoreDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.products)) {
        if (!parsed.reviews || !Array.isArray(parsed.reviews)) {
          parsed.reviews = INITIAL_REVIEWS;
        }
        if (!parsed.seasonalConfig) {
          parsed.seasonalConfig = INITIAL_SEASONAL_CONFIG;
        }
        if (!parsed.coupons || !Array.isArray(parsed.coupons)) {
          parsed.coupons = INITIAL_COUPONS;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading store_db.json, re-initializing defaults:', err);
  }

  // Seed default data
  const initialDb: StoreDatabase = {
    products: BEDSHEETS_CATALOG,
    orders: INITIAL_ORDERS,
    siteContent: INITIAL_SITE_CONTENT,
    reviews: INITIAL_REVIEWS,
    seasonalConfig: INITIAL_SEASONAL_CONFIG,
    coupons: INITIAL_COUPONS,
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  } catch (writeErr) {
    console.error('Error writing initial store_db.json:', writeErr);
  }

  return initialDb;
}

let db = initDatabase();

function saveDatabase(): void {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('Error persisting database:', writeErr);
    }
  }
}

async function startServer() {
  const app = express();

  // Support large base64 image uploads for custom photos and variants
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const IMAGES_DIR = path.join(__dirname, 'public', 'images');
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Serve uploaded and static images with no-cache revalidation so devices never get stuck on stale photos
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      },
    })
  );
  app.use(
    '/images',
    express.static(IMAGES_DIR, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    })
  );
  app.use('/images', express.static(path.join(__dirname, 'dist', 'images')));
  app.use('/src/assets/images', express.static(IMAGES_DIR));
  app.use('/src/assets/images', express.static(path.join(__dirname, 'src', 'assets', 'images')));

  // Fast cross-device sync-check endpoint so phone/tablets know within seconds when PC made edits
  app.get('/api/sync-check', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const latestTimestamp = Math.max(
      ...db.products.map((p) => p.updatedAt || 0),
      (db as any).theme?.updatedAt || 0,
      (db as any).seasonalConfig?.updatedAt || 0,
      (db as any).updatedAt || 0,
      0
    );
    res.json({
      timestamp: latestTimestamp,
      productCount: db.products.length,
      ordersCount: db.orders.length,
      themeUpdatedAt: (db as any).theme?.updatedAt || 0,
      seasonalUpdatedAt: (db as any).seasonalConfig?.updatedAt || 0,
    });
  });

  // Dedicated JPG Photo Endpoint: ALWAYS returns fresh JPEG with proper no-cache revalidation
  app.get(['/photo/:id', '/photo/:id.jpg'], (req, res) => {
    let id = req.params.id || '';
    if (id.endsWith('.jpg')) {
      id = id.slice(0, -4);
    }

    const filenamesToTry = [
      id,
      `${id}.jpg`,
      `${id}.png`,
      `${id}.jpeg`,
    ];

    const dirsToSearch = [
      path.join(__dirname, 'public', 'images'),
      path.join(__dirname, 'public', 'uploads'),
      path.join(__dirname, 'src', 'assets', 'images'),
    ];

    for (const dir of dirsToSearch) {
      for (const fn of filenamesToTry) {
        const fullPath = path.join(dir, fn);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          res.setHeader('Content-Type', fn.endsWith('.png') ? 'image/png' : 'image/jpeg');
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          return res.sendFile(fullPath);
        }
      }
    }

    // Match by product ID in database or catalog
    const product = db.products.find((p) => p.id === id);
    if (product && product.image) {
      const imgPath = product.image.replace(/^\/(?:src\/assets\/images|images|uploads)\//, '');
      for (const dir of dirsToSearch) {
        const fullPath = path.join(dir, imgPath);
        if (fs.existsSync(fullPath)) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          return res.sendFile(fullPath);
        }
      }
    }

    // Fallback to first sheet
    const defaultSheet = path.join(__dirname, 'public', 'images', 'exact_sheet1_pink_rose_1790997736396.jpg');
    if (fs.existsSync(defaultSheet)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(defaultSheet);
    }

    res.status(404).send('Photo not found');
  });

  // App configuration endpoint so client knows public URL
  app.get('/api/config', (_req, res) => {
    const publicUrl = process.env.APP_URL || '';
    res.json({ appUrl: publicUrl });
  });

  function initCloudinary() {
    return getCloudinaryConfig();
  }

  // Cloudinary Signature generation for secure signed direct uploads (GET and POST)
  app.all('/api/cloudinary-sign', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const config = initCloudinary();

      if (!config || !config.cloudName || !config.apiKey || !config.apiSecret) {
        return res.status(503).json({
          configured: false,
          error: 'Cloudinary credentials are not configured on server.',
          help: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) environment variables.',
        });
      }

      const query = req.query || {};
      const body = req.body || {};
      const productId = (query.productId || body.productId || '').trim();
      const explicitPublicId = (query.public_id || body.public_id || '').trim();

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

      res.json({
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
      res.status(500).json({ error: err.message || 'Failed to generate signature' });
    }
  });

  // Dedicated image upload API with primary Cloudinary support
  app.post('/api/upload', async (req, res) => {
    try {
      const { image, productId, public_id } = req.body || {};
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // If already a Cloudinary URL or remote HTTPS URL, return directly
      if (image.startsWith('https://res.cloudinary.com/') || image.startsWith('http://') || image.startsWith('https://')) {
        return res.json({ url: image, provider: 'cloudinary' });
      }

      // Try uploading to Cloudinary first
      const config = initCloudinary();
      if (config) {
        try {
          const uploadOptions: any = {
            folder: 'cotton_nest/bedsheets',
            resource_type: 'image',
            overwrite: true,
            tags: ['cotton_nest', productId ? `product_${productId}` : 'general_sheet'],
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ]
          };

          if (public_id) {
            uploadOptions.public_id = public_id;
          } else if (productId) {
            const sanitized = productId.replace(/[^a-zA-Z0-9-_]/g, '_');
            uploadOptions.public_id = `sheet_${sanitized}_${Date.now()}`;
          }

          const result = await cloudinary.uploader.upload(image, uploadOptions);
          return res.json({
            url: result.secure_url,
            public_id: result.public_id,
            provider: 'cloudinary',
            width: result.width,
            height: result.height,
            format: result.format,
          });
        } catch (cloudErr: any) {
          console.warn('Cloudinary upload had an issue, falling back to permanent server storage:', cloudErr.message);
        }
      }

      // Guaranteed local fallback if Cloudinary encounters network or quota limits
      const matches = image.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : (matches[1] || 'jpg');
        const filename = `sheet_${(productId || 'custom').replace(/[^a-zA-Z0-9-_]/g, '_')}_${Date.now()}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));
        return res.json({
          url: `/uploads/${filename}`,
          provider: 'server',
        });
      }

      res.status(400).json({ error: 'Invalid image format provided' });
    } catch (err: any) {
      console.error('Failed to process image upload:', err);
      res.status(500).json({ error: err.message || 'Failed to save image' });
    }
  });

  // Secure deletion endpoint for old Cloudinary images (keeps secret on server)
  app.post('/api/cloudinary-delete', async (req, res) => {
    try {
      const { public_id } = req.body || {};
      if (!public_id || typeof public_id !== 'string') {
        return res.status(400).json({ error: 'public_id is required' });
      }

      // Security check: only allow deletion within store folders
      if (!public_id.includes('cotton_nest') && !public_id.startsWith('sheet_')) {
        return res.status(403).json({ error: 'Cannot delete assets outside store folder' });
      }

      const config = initCloudinary();
      if (!config) {
        return res.status(503).json({ error: 'Cloudinary not configured' });
      }

      const result = await cloudinary.uploader.destroy(public_id);
      res.json({ success: true, result });
    } catch (err: any) {
      console.error('Failed to delete Cloudinary asset:', err);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  });

  /* ------------------- REST API ROUTES ------------------- */

  // Products API
  app.get('/api/products', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
          db.products = parsed.products;
        }
      }
    } catch {}
    res.json(db.products);
  });

  app.post('/api/products', (req, res) => {
    const newProduct = req.body;
    if (!newProduct || !newProduct.name) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!newProduct.id) {
      newProduct.id = `sheet-${Date.now().toString(36)}`;
    }
    const now = Date.now();
    newProduct.updatedAt = now;
    (db as any).updatedAt = now;
    db.products.unshift(newProduct);
    saveDatabase();
    res.status(201).json(newProduct);
  });

  app.put('/api/products', (req, res) => {
    if (Array.isArray(req.body)) {
      const now = Date.now();
      db.products = req.body.map((p: any, idx: number) => ({
        ...p,
        order: typeof p.order === 'number' ? p.order : idx,
        updatedAt: p.updatedAt || now,
      }));
      (db as any).updatedAt = now;
      saveDatabase();
      return res.json(db.products);
    }
    res.status(400).json({ error: 'Invalid products payload' });
  });

  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const now = Date.now();
    (db as any).updatedAt = now;
    db.products[index] = { ...db.products[index], ...updated, updatedAt: now };
    saveDatabase();
    res.json(db.products[index]);
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const beforeCount = db.products.length;
    db.products = db.products.filter((p) => p.id !== id);
    if (db.products.length === beforeCount) {
      return res.status(404).json({ error: 'Product not found' });
    }
    (db as any).updatedAt = Date.now();
    saveDatabase();
    res.json({ success: true, id });
  });

  // Orders API with User-Specific Filtering & Live Admin Sync
  app.get('/api/orders', (req, res) => {
    const { email, phone, userId, orderId } = req.query as Record<string, string | undefined>;

    let result = db.orders;

    // If specific order ID requested
    if (orderId) {
      result = result.filter(
        (o) => o.id?.toLowerCase() === orderId.toLowerCase()
      );
      return res.json(result);
    }

    // If user identification filters provided, show ONLY that person's orders
    if (email || phone || userId) {
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
      const cleanUserId = userId ? userId.trim() : '';

      result = result.filter((o) => {
        const oEmail = o.customerEmail ? o.customerEmail.trim().toLowerCase() : '';
        const oPhone = o.customerPhone ? o.customerPhone.replace(/[^0-9]/g, '') : '';
        const oUserId = o.userId ? o.userId.trim() : '';

        const matchesEmail = cleanEmail && oEmail && oEmail === cleanEmail;
        const matchesPhone = cleanPhone && oPhone && (oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone));
        const matchesUserId = cleanUserId && oUserId && oUserId === cleanUserId;

        return matchesEmail || matchesPhone || matchesUserId;
      });
    }

    res.json(result);
  });

  app.post('/api/orders', (req, res) => {
    const newOrder = req.body;
    if (!newOrder || !newOrder.id) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    if (!newOrder.timeline || !Array.isArray(newOrder.timeline) || newOrder.timeline.length === 0) {
      newOrder.timeline = [
        {
          status: newOrder.status || 'pending',
          timestamp: new Date().toISOString(),
          title: 'Order Placed',
          description: 'Order received at Cotton Nest Atelier, Sector 46 Gurgaon.'
        }
      ];
    }

    if (!newOrder.trackingNumber) {
      newOrder.trackingNumber = `CN-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    db.orders.unshift(newOrder);
    saveDatabase();
    res.status(201).json(newOrder);
  });

  app.put('/api/orders', (req, res) => {
    if (Array.isArray(req.body)) {
      db.orders = req.body;
      saveDatabase();
      return res.json(db.orders);
    }
    res.status(400).json({ error: 'Invalid orders payload' });
  });

  app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const index = db.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousOrder = db.orders[index];
    const newStatus = updated.status;

    // If status has changed, automatically append to timeline if not already there
    let updatedTimeline = updated.timeline || previousOrder.timeline || [];
    if (newStatus && newStatus !== previousOrder.status) {
      const titles: Record<string, { title: string; description: string }> = {
        pending: {
          title: 'Order Received',
          description: 'Order queued for verification.'
        },
        confirmed: {
          title: 'Verified & Inspected',
          description: 'Inspected for thread count and quality at Sector 46 Gurgaon Atelier.'
        },
        dispatched: {
          title: 'Dispatched & In Transit',
          description: 'Handed over to express courier. Out for delivery.'
        },
        delivered: {
          title: 'Delivered Successfully',
          description: 'Package delivered to the customer.'
        },
        cancelled: {
          title: 'Order Cancelled',
          description: 'This order was cancelled.'
        }
      };

      const stepInfo = titles[newStatus] || {
        title: `Status: ${newStatus}`,
        description: 'Order status updated by Cotton Nest Atelier.'
      };

      // Only append if last step is not already this status
      const lastStep = updatedTimeline[updatedTimeline.length - 1];
      if (!lastStep || lastStep.status !== newStatus) {
        updatedTimeline = [
          ...updatedTimeline,
          {
            status: newStatus,
            timestamp: new Date().toISOString(),
            title: stepInfo.title,
            description: stepInfo.description
          }
        ];
      }
    }

    db.orders[index] = {
      ...previousOrder,
      ...updated,
      timeline: updatedTimeline
    };

    saveDatabase();
    res.json(db.orders[index]);
  });

  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    db.orders = db.orders.filter((o) => o.id !== id);
    saveDatabase();
    res.json({ success: true, id });
  });

  // Site Content API
  app.get('/api/content', (_req, res) => {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.siteContent) {
          db.siteContent = parsed.siteContent;
        }
      }
    } catch {}
    res.json(db.siteContent);
  });

  app.put('/api/content', (req, res) => {
    db.siteContent = req.body;
    saveDatabase();
    res.json(db.siteContent);
  });

  // Website Appearance & Festival Theme API
  app.get('/api/theme', (_req, res) => {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.theme) {
          (db as any).theme = parsed.theme;
        }
      }
    } catch {}
    res.json((db as any).theme || {
      activeThemeId: 'classic',
      themeName: 'Classic Cotton Nest',
      colors: {
        primary: '#70252D',
        secondary: '#8C3A44',
        background: '#FAF7F2',
        surface: '#FFFFFF',
        text: '#2C2420',
        textSecondary: '#6B5D55',
        accent: '#C29E57',
        header: '#FAF7F2',
        footer: '#2C2420',
        footerText: '#FAF7F2',
      },
      updatedAt: Date.now(),
    });
  });

  app.post('/api/theme', (req, res) => {
    (db as any).theme = req.body;
    saveDatabase();
    res.json({ success: true, theme: (db as any).theme });
  });

  // Seasonal Page & Festive Deals API
  app.get('/api/seasonal', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.seasonalConfig) {
          (db as any).seasonalConfig = parsed.seasonalConfig;
        }
      }
    } catch {}
    res.json((db as any).seasonalConfig || INITIAL_SEASONAL_CONFIG);
  });

  app.post('/api/seasonal', (req, res) => {
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ error: 'Invalid seasonal configuration' });
    }
    const now = Date.now();
    const finalConfig = {
      ...INITIAL_SEASONAL_CONFIG,
      ...updated,
      updatedAt: now,
    };
    (db as any).seasonalConfig = finalConfig;
    (db as any).updatedAt = now;
    saveDatabase();
    res.json(finalConfig);
  });

  app.put('/api/seasonal', (req, res) => {
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ error: 'Invalid seasonal configuration' });
    }
    const now = Date.now();
    const finalConfig = {
      ...INITIAL_SEASONAL_CONFIG,
      ...updated,
      updatedAt: now,
    };
    (db as any).seasonalConfig = finalConfig;
    (db as any).updatedAt = now;
    saveDatabase();
    res.json(finalConfig);
  });

  // Customer Reviews API
  app.get('/api/reviews', (_req, res) => {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.reviews)) {
          db.reviews = parsed.reviews;
        }
      }
    } catch {}
    res.json(db.reviews || INITIAL_REVIEWS);
  });

  app.post('/api/reviews', (req, res) => {
    const review = req.body;
    if (!review || !review.customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!review.id) {
      review.id = `rev-${Date.now()}`;
    }
    if (!db.reviews) db.reviews = [...INITIAL_REVIEWS];
    db.reviews.unshift(review);
    saveDatabase();
    res.status(201).json(review);
  });

  app.post('/api/reviews/:id/helpful', (req, res) => {
    const { id } = req.params;
    if (!db.reviews) db.reviews = [...INITIAL_REVIEWS];
    const target = db.reviews.find((r) => r.id === id);
    if (target) {
      target.helpfulCount = (target.helpfulCount || 0) + 1;
      saveDatabase();
      return res.json(target);
    }
    res.status(404).json({ error: 'Review not found' });
  });

  app.delete('/api/reviews/:id', (req, res) => {
    const { id } = req.params;
    if (!db.reviews) db.reviews = [...INITIAL_REVIEWS];
    db.reviews = db.reviews.filter((r) => r.id !== id);
    saveDatabase();
    res.json({ success: true, id });
  });

  /* ------------------- COUPONS & OFFERS API ------------------- */

  // 1. Get all coupons
  app.get('/api/coupons', (_req, res) => {
    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    res.json(db.coupons);
  });

  // 2. Create or Update coupon
  app.post('/api/coupons', (req, res) => {
    const coupon: CouponOffer = req.body;
    if (!coupon || !coupon.code || !coupon.discountValue) {
      return res.status(400).json({ error: 'Coupon code and discount value are required.' });
    }

    if (!coupon.id) {
      coupon.id = `coupon-${Date.now()}`;
    }
    coupon.code = coupon.code.trim().toUpperCase();
    coupon.updatedAt = Date.now();
    if (!coupon.createdAt) coupon.createdAt = Date.now();

    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    const existingIdx = db.coupons.findIndex((c) => c.id === coupon.id || c.code.toUpperCase() === coupon.code.toUpperCase());
    if (existingIdx >= 0) {
      db.coupons[existingIdx] = { ...db.coupons[existingIdx], ...coupon };
    } else {
      db.coupons.unshift(coupon);
    }

    saveDatabase();
    res.status(200).json(coupon);
  });

  // 3. Delete coupon
  app.delete('/api/coupons/:id', (req, res) => {
    const { id } = req.params;
    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    db.coupons = db.coupons.filter((c) => c.id !== id && c.code.toUpperCase() !== id.toUpperCase());
    saveDatabase();
    res.json({ success: true, id });
  });

  // 4. Secure Server-side Coupon Validation
  app.post('/api/coupons/validate', (req, res) => {
    const { code, items, subtotal, customerIdentifier } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Coupon code is required.' });
    }

    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    const cleanCode = code.trim().toUpperCase();
    const coupon = db.coupons.find((c) => c.code.toUpperCase() === cleanCode);

    if (!coupon) {
      return res.json({ valid: false, error: 'Invalid coupon code. Please verify spelling.' });
    }

    if (!coupon.isActive) {
      return res.json({ valid: false, error: 'This coupon is currently inactive.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (coupon.startDate && todayStr < coupon.startDate) {
      return res.json({ valid: false, error: `This coupon starts on ${coupon.startDate}.` });
    }
    if (coupon.expiryDate && todayStr > coupon.expiryDate) {
      return res.json({ valid: false, error: `This coupon expired on ${coupon.expiryDate}.` });
    }

    if (typeof coupon.maxUses === 'number' && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return res.json({ valid: false, error: 'Coupon usage limit has been reached.' });
    }

    if (coupon.oneUsePerCustomer && customerIdentifier && Array.isArray(coupon.usedByCustomers)) {
      const cleanCustomer = String(customerIdentifier).trim().toLowerCase();
      if (coupon.usedByCustomers.some((c) => c.toLowerCase() === cleanCustomer)) {
        return res.json({ valid: false, error: 'You have already redeemed this coupon once.' });
      }
    }

    const orderSubtotal = Number(subtotal) || 0;
    let eligibleSubtotal = orderSubtotal;
    const cartItems = Array.isArray(items) ? items : [];

    if (coupon.scope === 'products' && Array.isArray(coupon.applicableProductIds)) {
      eligibleSubtotal = cartItems.reduce((acc, it) => {
        const pId = it.product?.id || it.productId;
        const pPrice = Number(it.product?.price || it.price) || 0;
        const pQty = Number(it.quantity) || 1;
        if (coupon.applicableProductIds!.includes(pId)) {
          return acc + pPrice * pQty;
        }
        return acc;
      }, 0);
      if (eligibleSubtotal <= 0) {
        return res.json({ valid: false, error: 'This coupon is only valid for selected bedsheets.' });
      }
    } else if (coupon.scope === 'collections' && Array.isArray(coupon.applicableCollections)) {
      const collSet = new Set(coupon.applicableCollections.map((c) => c.toLowerCase()));
      eligibleSubtotal = cartItems.reduce((acc, it) => {
        const coll = (it.product?.collection || '').toLowerCase();
        const pPrice = Number(it.product?.price || it.price) || 0;
        const pQty = Number(it.quantity) || 1;
        if (collSet.has(coll)) {
          return acc + pPrice * pQty;
        }
        return acc;
      }, 0);
      if (eligibleSubtotal <= 0) {
        return res.json({ valid: false, error: 'This coupon is only valid for specific bedding collections.' });
      }
    }

    if (coupon.minOrderValue && eligibleSubtotal < coupon.minOrderValue) {
      const diff = coupon.minOrderValue - eligibleSubtotal;
      return res.json({
        valid: false,
        error: `Minimum bag value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required. Add ₹${diff.toLocaleString('en-IN')} more to apply.`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((eligibleSubtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(eligibleSubtotal, Math.round(coupon.discountValue));
    }

    discountAmount = Math.min(discountAmount, orderSubtotal);

    res.json({
      valid: true,
      coupon,
      discountAmount,
      message: `Coupon ${coupon.code} applied! ₹${discountAmount.toLocaleString('en-IN')} saved.`,
    });
  });

  // 5. Record coupon redemption
  app.post('/api/coupons/record-use', (req, res) => {
    const { couponId, customerIdentifier } = req.body;
    if (!couponId) {
      return res.status(400).json({ error: 'couponId is required.' });
    }

    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    const target = db.coupons.find((c) => c.id === couponId || c.code.toUpperCase() === String(couponId).toUpperCase());
    if (target) {
      target.usedCount = (target.usedCount || 0) + 1;
      if (!Array.isArray(target.usedByCustomers)) {
        target.usedByCustomers = [];
      }
      if (customerIdentifier && !target.usedByCustomers.includes(String(customerIdentifier).trim())) {
        target.usedByCustomers.push(String(customerIdentifier).trim());
      }
      target.updatedAt = Date.now();
      saveDatabase();
      return res.json({ success: true, coupon: target });
    }
    res.status(404).json({ error: 'Coupon not found.' });
  });

  // Reset database back to default factory settings
  app.post('/api/reset', (_req, res) => {
    db = {
      products: BEDSHEETS_CATALOG,
      orders: INITIAL_ORDERS,
      siteContent: INITIAL_SITE_CONTENT,
    };
    saveDatabase();
    res.json({ success: true, message: 'Factory reset completed' });
  });

  /* ------------------- FRONTEND / VITE INTEGRATION ------------------- */

  if (!isProduction) {
    // Development mode: attach Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cotton Nest Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
