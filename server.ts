import 'dotenv/config';
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
import { WishlistItem } from './src/data/wishlist.ts';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LOYALTY_MIN_REDEMPTION_POINTS,
  LOYALTY_MAX_REDEMPTION_POINTS,
  calculateEarnedPoints,
  calculatePointsDiscount,
  getTransactionExpiryDate,
  generateReferralCode,
  sanitizeLoyaltyKey,
} from './src/data/loyalty.ts';
import { generateProductDescription } from './api/ai-description.ts';
import { sendOtpEmail, verifyOtp, sendOrderInvoiceEmail, buildCottonNestInvoiceHtml } from './api/otp-service.ts';
import {
  OrderComplaint,
  validateComplaintSubmission,
  applyAdminComplaintUpdate,
  normalizePhoneDigits,
} from './src/data/complaints.ts';
import {
  AppNotification,
  INITIAL_CUSTOMER_NOTIFICATIONS,
  buildComplaintNotificationForCustomer,
  buildComplaintNotificationForAdmin,
} from './src/data/notifications.ts';

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
  complaints?: OrderComplaint[];
  notifications?: AppNotification[];
  siteContent: any;
  theme?: any;
  reviews?: any[];
  seasonalConfig?: any;
  coupons?: CouponOffer[];
  wishlists?: WishlistItem[];
  loyaltyAccounts?: Record<string, LoyaltyAccount>;
  loyaltyTransactions?: LoyaltyTransaction[];
  wishlistNotificationSettings?: {
    enabled: boolean;
    dailyLimit: number;
    weeklyLimit: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    cooldownHours: number;
  };
  wishlistNotificationHistories?: Record<string, any>;
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
        let needsSave = false;
        // Ensure all products have size, productType, and brand
        parsed.products = parsed.products.map((p: any) => {
          let modified = false;
          const updated = { ...p };
          if (!updated.size) {
            updated.size = 'King';
            modified = true;
          }
          if (!updated.productType) {
            updated.productType = 'Bedsheet';
            modified = true;
          }
          if (!updated.brand) {
            updated.brand = 'Cotton Nest';
            modified = true;
          }
          if (modified) needsSave = true;
          return updated;
        });

        // Only seed default catalog items if products list is completely empty
        if (parsed.products.length === 0) {
          parsed.products = [...BEDSHEETS_CATALOG];
          needsSave = true;
        }

        if (!parsed.reviews || !Array.isArray(parsed.reviews)) {
          parsed.reviews = INITIAL_REVIEWS;
          needsSave = true;
        }
        if (!parsed.seasonalConfig) {
          parsed.seasonalConfig = INITIAL_SEASONAL_CONFIG;
          needsSave = true;
        }
        if (!parsed.coupons || !Array.isArray(parsed.coupons)) {
          parsed.coupons = INITIAL_COUPONS;
          needsSave = true;
        }
        if (!parsed.wishlists || !Array.isArray(parsed.wishlists)) {
          parsed.wishlists = [];
          needsSave = true;
        }
        if (!parsed.loyaltyAccounts || typeof parsed.loyaltyAccounts !== 'object') {
          parsed.loyaltyAccounts = {};
          needsSave = true;
        } else {
          // Sanitize legacy keys and merge duplicate accounts
          const sanitizedMap: Record<string, LoyaltyAccount> = {};
          for (const [k, acc] of Object.entries(parsed.loyaltyAccounts as Record<string, any>)) {
            if (!acc || typeof acc !== 'object') continue;
            const canonical = sanitizeLoyaltyKey(k);
            if (!sanitizedMap[canonical]) {
              sanitizedMap[canonical] = {
                ...acc,
                id: canonical,
                referralCode: acc.referralCode || generateReferralCode(acc.customerName || canonical),
              };
            } else {
              const cur = sanitizedMap[canonical];
              cur.lifetimeEarned = Math.max(cur.lifetimeEarned || 0, acc.lifetimeEarned || 0);
              cur.lifetimeSpent = Math.max(cur.lifetimeSpent || 0, acc.lifetimeSpent || 0);
              cur.pointsBalance = Math.max(0, cur.lifetimeEarned - cur.lifetimeSpent);
              if (acc.phone) cur.phone = cur.phone || acc.phone;
              if (acc.email) cur.email = cur.email || acc.email;
              if (acc.customerName) cur.customerName = cur.customerName || acc.customerName;
            }
            if (k !== canonical) needsSave = true;
          }
          parsed.loyaltyAccounts = sanitizedMap;
        }

        if (!parsed.loyaltyTransactions || !Array.isArray(parsed.loyaltyTransactions)) {
          parsed.loyaltyTransactions = [];
          needsSave = true;
        }

        // Reconcile points from orders: Earned points ONLY when status === 'delivered'; Redeemed points on non-cancelled orders
        if (Array.isArray(parsed.orders)) {
          const orderStatusMap = new Map<string, string>();
          parsed.orders.forEach((o: any) => {
            if (o && o.id) orderStatusMap.set(String(o.id), String(o.status || 'pending'));
          });

          // Remove any premature 'earned' transactions for orders that are not yet delivered
          const prevTxLen = parsed.loyaltyTransactions.length;
          parsed.loyaltyTransactions = parsed.loyaltyTransactions.filter((t: any) => {
            if (t && t.type === 'earned' && t.orderId && orderStatusMap.has(String(t.orderId))) {
              return orderStatusMap.get(String(t.orderId)) === 'delivered';
            }
            return true;
          });
          if (parsed.loyaltyTransactions.length !== prevTxLen) {
            needsSave = true;
          }

          const keyStats: Record<string, { earned: number; spent: number; name?: string; phone?: string; email?: string; userId?: string }> = {};

          parsed.orders.forEach((o: any) => {
            if (!o) return;
            if (o.status === 'cancelled') {
              o.pointsCredited = false;
              return;
            }
            const ship = Number(o.shippingCost) || 0;
            const net = Math.max(0, (Number(o.totalAmount) || Number(o.subtotal) || 0) - ship);
            const pts = typeof o.pointsEarned === 'number' && o.pointsEarned > 0 ? o.pointsEarned : calculateEarnedPoints(net);
            const spent = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, Math.max(0, Number(o.pointsUsed) || 0));
            const isDelivered = o.status === 'delivered';

            o.pointsEarned = pts;
            if (o.pointsCredited !== isDelivered) {
              o.pointsCredited = isDelivered;
              needsSave = true;
            }

            const candidateKeys: string[] = [];
            if (o.customerPhone) candidateKeys.push(sanitizeLoyaltyKey(o.customerPhone));
            if (o.customerEmail) candidateKeys.push(sanitizeLoyaltyKey(o.customerEmail));
            if (o.userId) candidateKeys.push(sanitizeLoyaltyKey(o.userId));
            if (candidateKeys.length === 0) candidateKeys.push('guest_default_wallet');

            const uniqueKeys = Array.from(new Set(candidateKeys.filter(Boolean)));
            const now = Date.now();
            const expiry = getTransactionExpiryDate(now);

            uniqueKeys.forEach((k) => {
              if (!keyStats[k]) {
                keyStats[k] = { earned: 0, spent: 0, name: o.customerName, phone: o.customerPhone, email: o.customerEmail, userId: o.userId };
              }
              if (isDelivered) {
                keyStats[k].earned += pts;
                if (pts > 0) {
                  const hasEarnedTx = parsed.loyaltyTransactions.some(
                    (t: any) => t.accountId === k && t.orderId === o.id && t.type === 'earned' && t.points > 0
                  );
                  if (!hasEarnedTx) {
                    parsed.loyaltyTransactions.unshift({
                      id: `tx_earn_${o.id}_${k}_${now}`,
                      accountId: k,
                      orderId: o.id,
                      type: 'earned',
                      points: pts,
                      amountInr: net,
                      description: `Earned on Delivered Order #${o.id} (5 pts / ₹100)`,
                      createdAt: o.deliveredAt ? new Date(o.deliveredAt).getTime() || now : now,
                      expiresAt: expiry,
                      status: 'credited',
                    });
                    needsSave = true;
                  }
                }
              }
              keyStats[k].spent += spent;
            });
          });

          for (const [k, stats] of Object.entries(keyStats)) {
            const referralBonus = parsed.loyaltyTransactions
              .filter((t: any) => t && t.accountId === k && (t.type === 'referral' || t.type === 'bonus') && t.points > 0)
              .reduce((sum: number, t: any) => sum + Number(t.points || 0), 0);

            if (!parsed.loyaltyAccounts[k]) {
              const totalEarned = stats.earned + referralBonus;
              parsed.loyaltyAccounts[k] = {
                id: k,
                customerName: stats.name || 'Cotton Nest Client',
                phone: stats.phone,
                email: stats.email,
                userId: stats.userId,
                pointsBalance: Math.max(0, totalEarned - stats.spent),
                lifetimeEarned: totalEarned,
                lifetimeSpent: stats.spent,
                referralPointsEarned: referralBonus,
                referralCode: generateReferralCode(stats.name || k),
                referralCount: 0,
                updatedAt: Date.now(),
              };
              needsSave = true;
            } else {
              const acc = parsed.loyaltyAccounts[k];
              const effectiveReferral = Math.max(acc.referralPointsEarned || 0, referralBonus);
              const effectiveEarned = Math.max(acc.lifetimeEarned || 0, stats.earned + effectiveReferral);
              const safeAccSpent = (acc.lifetimeSpent || 0) <= effectiveEarned ? (acc.lifetimeSpent || 0) : 0;
              const effectiveSpent = Math.max(safeAccSpent, stats.spent);
              const computedBalance = Math.max(0, effectiveEarned - effectiveSpent);

              if (acc.pointsBalance !== computedBalance || acc.lifetimeSpent !== effectiveSpent || acc.lifetimeEarned !== effectiveEarned) {
                acc.pointsBalance = computedBalance;
                acc.lifetimeEarned = effectiveEarned;
                acc.lifetimeSpent = effectiveSpent;
                needsSave = true;
              }
              if (stats.phone && !acc.phone) acc.phone = stats.phone;
              if (stats.email && !acc.email) acc.email = stats.email;
            }
          }
        }
        if (!parsed.complaints || !Array.isArray(parsed.complaints)) {
          parsed.complaints = [];
          needsSave = true;
        }
        if (!parsed.notifications || !Array.isArray(parsed.notifications)) {
          parsed.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
          needsSave = true;
        }
        if (needsSave) {
          try {
            fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch (writeErr) {
            console.error('Error saving updated initial store_db.json:', writeErr);
          }
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
    complaints: [],
    notifications: [...INITIAL_CUSTOMER_NOTIFICATIONS],
    siteContent: INITIAL_SITE_CONTENT,
    reviews: INITIAL_REVIEWS,
    seasonalConfig: INITIAL_SEASONAL_CONFIG,
    coupons: INITIAL_COUPONS,
    wishlists: [],
    loyaltyAccounts: {},
    loyaltyTransactions: [],
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

  // Support large media uploads for custom photos, variants, and product videos
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const IMAGES_DIR = path.join(__dirname, 'public', 'images');
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Serve uploaded and static images/videos with proper range request support for video streaming
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      acceptRanges: true,
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
        return res.status(200).json({
          configured: false,
          error: 'Cloudinary credentials are not configured on server.',
          help: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) environment variables.',
        });
      }

      const query = req.query || {};
      const body = req.body || {};
      const productId = String(query.productId || body.productId || '').trim();
      const orderId = String(query.orderId || body.orderId || '').trim();
      const requestedFolder = String(query.folder || body.folder || '').trim();
      const explicitPublicId = String(query.public_id || body.public_id || '').trim();

      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder =
        requestedFolder && requestedFolder.startsWith('cotton_nest/')
          ? requestedFolder
          : orderId
          ? 'cotton_nest/complaints'
          : 'cotton_nest/bedsheets';

      const paramsToSign: Record<string, any> = {
        folder,
        timestamp,
      };

      let assignedPublicId: string | undefined;
      if (explicitPublicId) {
        assignedPublicId = explicitPublicId;
        paramsToSign.public_id = assignedPublicId;
      } else if (orderId && productId) {
        const safeOrder = orderId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const safeProd = productId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const randSuffix = Math.random().toString(36).slice(2, 6);
        assignedPublicId = `complaint_${safeOrder}_${safeProd}_${timestamp}_${randSuffix}`;
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

  // High-speed direct binary upload endpoint (zero Base64 overhead, prevents event-loop freeze on large videos)
  app.post(
    '/api/upload-binary',
    express.raw({ type: '*/*', limit: '200mb' }),
    async (req, res) => {
      try {
        const buffer = req.body;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
          return res.status(400).json({ error: 'Binary media payload is required' });
        }

        const productId = String(req.query.productId || 'custom').replace(/[^a-zA-Z0-9-_]/g, '_');
        const orderId = String(req.query.orderId || '').replace(/[^a-zA-Z0-9-_]/g, '_');
        const requestedFolder = String(req.query.folder || '').trim();
        const explicitPublicId = String(req.query.public_id || '').replace(/[^a-zA-Z0-9-_]/g, '_');
        const targetFolder =
          requestedFolder && requestedFolder.startsWith('cotton_nest/')
            ? requestedFolder
            : orderId
            ? 'cotton_nest/complaints'
            : 'cotton_nest/bedsheets';

        const mime = String(req.headers['content-type'] || '').toLowerCase();
        const isVideo =
          req.query.resource_type === 'video' ||
          mime.startsWith('video/') ||
          /\.(mp4|webm|mov|m4v|ogg)$/i.test(String(req.query.filename || ''));

        let ext = String(req.query.ext || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (!ext) {
          if (mime.includes('webm')) ext = 'webm';
          else if (mime.includes('quicktime') || mime.includes('mov')) ext = 'mov';
          else if (mime.includes('ogg')) ext = 'ogg';
          else if (isVideo) ext = 'mp4';
          else if (mime.includes('png')) ext = 'png';
          else if (mime.includes('webp')) ext = 'webp';
          else ext = 'jpg';
        }

        const basePublicId =
          explicitPublicId ||
          (orderId
            ? `complaint_${orderId}_${productId}_${Date.now()}`
            : `sheet_${productId}_${Date.now()}`);
        const filename = `${basePublicId}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        await fs.promises.writeFile(filepath, buffer);

        // If Cloudinary is configured, attempt upload from local file in background or directly
        const config = initCloudinary();
        if (config) {
          try {
            const result = await cloudinary.uploader.upload(filepath, {
              folder: targetFolder,
              resource_type: isVideo ? 'video' : 'auto',
              overwrite: true,
              public_id: basePublicId,
              tags: [
                'cotton_nest',
                ...(orderId ? ['complaint', `order_${orderId}`] : []),
                `product_${productId}`,
              ],
            });
            if (result?.secure_url) {
              return res.json({
                url: result.secure_url,
                public_id: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                provider: 'cloudinary',
                resource_type: result.resource_type || (isVideo ? 'video' : 'image'),
              });
            }
          } catch (cloudErr: any) {
            console.warn('Binary Cloudinary upload fallback to local server file:', cloudErr.message);
          }
        }

        return res.json({
          url: `/uploads/${filename}`,
          public_id: `${targetFolder}/${basePublicId}`,
          provider: 'server',
          resource_type: isVideo ? 'video' : 'image',
        });
      } catch (err: any) {
        console.error('Failed to process binary media upload:', err);
        return res.status(500).json({ error: err.message || 'Failed to save binary media' });
      }
    }
  );

  // Dedicated media (image & video) upload API with primary Cloudinary support
  app.post('/api/upload', async (req, res) => {
    try {
      const { image, media, productId, orderId, folder: reqFolder, public_id, resource_type } = req.body || {};
      const mediaData = media || image;
      if (!mediaData || typeof mediaData !== 'string') {
        return res.status(400).json({ error: 'Media data is required' });
      }

      // If already a Cloudinary URL or remote HTTPS URL, return directly
      if (mediaData.startsWith('https://res.cloudinary.com/') || mediaData.startsWith('http://') || mediaData.startsWith('https://')) {
        return res.json({
          url: mediaData,
          public_id: public_id || `cotton_nest/external_${Date.now()}`,
          provider: 'cloudinary',
        });
      }

      const isVideo = resource_type === 'video' ||
        mediaData.startsWith('data:video/') ||
        /\.(mp4|webm|mov|m4v|ogg)($|\?)/i.test(mediaData);

      const safeProductId = String(productId || 'custom').replace(/[^a-zA-Z0-9-_]/g, '_');
      const safeOrderId = String(orderId || '').replace(/[^a-zA-Z0-9-_]/g, '_');
      const targetFolder =
        typeof reqFolder === 'string' && reqFolder.startsWith('cotton_nest/')
          ? reqFolder
          : safeOrderId
          ? 'cotton_nest/complaints'
          : 'cotton_nest/bedsheets';

      const basePublicId =
        (public_id && String(public_id).replace(/[^a-zA-Z0-9-_]/g, '_')) ||
        (safeOrderId
          ? `complaint_${safeOrderId}_${safeProductId}_${Date.now()}`
          : `sheet_${safeProductId}_${Date.now()}`);

      // Try uploading to Cloudinary first
      const config = initCloudinary();
      if (config) {
        try {
          const uploadOptions: any = {
            folder: targetFolder,
            resource_type: isVideo ? 'video' : 'auto',
            overwrite: true,
            public_id: basePublicId,
            tags: [
              'cotton_nest',
              ...(safeOrderId ? ['complaint', `order_${safeOrderId}`] : []),
              productId ? `product_${productId}` : 'general_sheet',
            ],
          };

          if (!isVideo) {
            uploadOptions.transformation = [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ];
          }

          const result = await cloudinary.uploader.upload(mediaData, uploadOptions);
          return res.json({
            url: result.secure_url,
            public_id: result.public_id,
            provider: 'cloudinary',
            width: result.width,
            height: result.height,
            format: result.format,
            resource_type: result.resource_type || (isVideo ? 'video' : 'image'),
          });
        } catch (cloudErr: any) {
          console.warn('Cloudinary upload had an issue, falling back to permanent server storage:', cloudErr.message);
        }
      }

      // Fast non-regex data URL parser (avoids catastrophic regex backtracking on large video/image buffers)
      const base64Marker = ';base64,';
      const markerIdx = mediaData.indexOf(base64Marker);
      if (mediaData.startsWith('data:') && markerIdx !== -1) {
        const header = mediaData.slice(5, markerIdx).toLowerCase(); // e.g. "video/mp4;codecs=avc1" or "image/jpeg"
        const mimeMain = header.split(';')[0] || '';
        const [mediaKind, rawSubtype] = mimeMain.split('/');
        const base64Payload = mediaData.slice(markerIdx + base64Marker.length);

        if (mediaKind === 'video' || isVideo) {
          let ext = 'mp4';
          if (rawSubtype === 'quicktime' || rawSubtype === 'mov') ext = 'mov';
          else if (rawSubtype === 'webm') ext = 'webm';
          else if (rawSubtype === 'ogg' || rawSubtype === 'ogv') ext = 'ogg';
          else if (rawSubtype === 'x-m4v' || rawSubtype === 'm4v') ext = 'm4v';

          const filename = `${basePublicId}.${ext}`;
          const filepath = path.join(UPLOADS_DIR, filename);
          await fs.promises.writeFile(filepath, Buffer.from(base64Payload, 'base64'));
          return res.json({
            url: `/uploads/${filename}`,
            public_id: `${targetFolder}/${basePublicId}`,
            provider: 'server',
            resource_type: 'video',
          });
        }

        let ext = 'jpg';
        if (rawSubtype === 'png') ext = 'png';
        else if (rawSubtype === 'webp') ext = 'webp';
        else if (rawSubtype === 'gif') ext = 'gif';

        const filename = `${basePublicId}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        await fs.promises.writeFile(filepath, Buffer.from(base64Payload, 'base64'));
        return res.json({
          url: `/uploads/${filename}`,
          public_id: `${targetFolder}/${basePublicId}`,
          provider: 'server',
          resource_type: 'image',
        });
      }

      res.status(400).json({ error: 'Invalid media format provided' });
    } catch (err: any) {
      console.error('Failed to process media upload:', err);
      res.status(500).json({ error: err.message || 'Failed to save media' });
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
      if (
        !public_id.includes('cotton_nest') &&
        !public_id.startsWith('sheet_') &&
        !public_id.startsWith('complaint_')
      ) {
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
    if (Array.isArray(req.body)) {
      const now = Date.now();
      db.products = req.body.map((p: any, idx: number) => ({
        ...p,
        order: typeof p.order === 'number' ? p.order : idx,
        updatedAt: p.updatedAt || now,
      }));
      (db as any).updatedAt = now;
      saveDatabase();
      return res.status(200).json(db.products);
    }
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

    const existingIdx = db.products.findIndex((p) => p.id === newProduct.id);
    if (existingIdx >= 0) {
      db.products[existingIdx] = newProduct;
    } else {
      db.products.unshift(newProduct);
    }
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
    const updated = req.body || {};
    const now = Date.now();
    (db as any).updatedAt = now;
    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) {
      // Upsert product if it exists in Firestore but not yet in local store_db.json
      const newEntry = {
        id,
        name: updated.name || id,
        collection: updated.collection || 'Signature Collection',
        size: updated.size || 'King',
        productType: updated.productType || 'Bedsheet',
        brand: updated.brand || 'Cotton Nest',
        price: Number(updated.price) || 1320,
        originalPrice: Number(updated.originalPrice) || Number(updated.price) || 1320,
        inStock: updated.inStock !== false,
        ...updated,
        updatedAt: now,
      };
      db.products.push(newEntry);
      saveDatabase();
      return res.json(newEntry);
    }
    db.products[index] = { ...db.products[index], ...updated, updatedAt: now };
    saveDatabase();
    res.json(db.products[index]);
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.products = db.products.filter((p) => p.id !== id);
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

    // If user identification filters provided, match that person's orders, or fallback to all orders if none matched
    if (email || phone || userId) {
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
      const cleanUserId = userId ? userId.trim() : '';

      const filtered = result.filter((o) => {
        const oEmail = o.customerEmail ? o.customerEmail.trim().toLowerCase() : '';
        const oPhone = o.customerPhone ? o.customerPhone.replace(/[^0-9]/g, '') : '';
        const oUserId = o.userId ? o.userId.trim() : '';

        const matchesEmail = cleanEmail && oEmail && oEmail === cleanEmail;
        const matchesPhone = cleanPhone && oPhone && (oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone));
        const matchesUserId = cleanUserId && oUserId && oUserId === cleanUserId;

        return matchesEmail || matchesPhone || matchesUserId;
      });

      if (filtered.length > 0) {
        result = filtered;
      }
    }

    res.json(result);
  });

  async function dispatchOrderSaleInvoice(order: any, options?: { forceResend?: boolean }) {
    try {
      if (!order || !order.id) return null;

      // Rule 1 & 8: Never generate an invoice for pending orders or orders cancelled before confirmation
      const currentStatus = String(order.status || 'pending').toLowerCase();
      if (currentStatus === 'pending') {
        order.invoiceGenerated = false;
        order.invoiceSent = false;
        order.invoiceStatus = 'pending_confirmation';
        order.invoiceMessage = 'Your invoice will be generated and available once your order is confirmed.';
        return null;
      }
      if (currentStatus === 'cancelled' && !order.invoiceGenerated && !order.invoiceSent && order.invoiceStatus !== 'generated') {
        order.invoiceGenerated = false;
        order.invoiceSent = false;
        order.invoiceStatus = 'cancelled_before_confirmation';
        order.invoiceMessage = 'Order was cancelled before confirmation. No invoice was generated.';
        return null;
      }

      // Rule 7: Prevent duplicate invoice generation or duplicate email sending
      const alreadyGenerated = Boolean(
        order.invoiceGenerated || order.invoiceSent || order.invoiceStatus === 'generated'
      );
      if (alreadyGenerated && !options?.forceResend) {
        return {
          success: true,
          alreadySent: true,
          sentViaSmtp: Boolean(order.invoiceResult?.sentViaSmtp),
          recipients: order.invoiceResult?.recipients || (order.customerEmail ? [order.customerEmail] : []),
          gmailComposeUrl: order.invoiceResult?.gmailComposeUrl,
          message: 'Invoice already generated and sent for this order.',
        };
      }

      const normalizedItems = Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            name: it.product?.name || it.productName || it.name || 'Pure Cotton Bedsheet',
            variantName: it.selectedVariant?.name || it.variantName,
            dimensions: it.product?.dimensions || it.dimensions || '108 x 108 inches',
            quantity: Number(it.quantity) || 1,
            price: Number(it.product?.price) || Number(it.price) || 0,
            imageUrl: it.selectedVariant?.image || it.product?.image || it.productImage || it.imageUrl || '',
          }))
        : [];

      const itemsSubtotal = normalizedItems.reduce(
        (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const couponDiscountVal = Number(order.couponDiscount) || 0;
      const pointsUsedVal = Number(order.pointsUsed) || 0;
      const pointsDiscountVal =
        Number(order.pointsDiscount) || (pointsUsedVal > 0 ? calculatePointsDiscount(pointsUsedVal) : 0);
      const shippingCostVal = Number(order.shippingCost) || 0;
      const finalPayableVal = Number(order.totalAmount) || 0;
      const resolvedSubtotal =
        itemsSubtotal > 0
          ? itemsSubtotal
          : Number(order.subtotal) > finalPayableVal
          ? Number(order.subtotal)
          : finalPayableVal + couponDiscountVal + pointsDiscountVal - shippingCostVal;

      const canonicalId = String(order.id).startsWith('CN-') ? String(order.id) : `CN-${order.id}`;
      const nowIso = new Date().toISOString();

      // Mark invoice as generated immediately before dispatch to prevent concurrent duplicate triggers
      order.invoiceNumber = order.invoiceNumber || `INV-${canonicalId}`;
      order.invoiceGenerated = true;
      order.invoiceGeneratedAt = order.invoiceGeneratedAt || nowIso;
      order.subtotal = resolvedSubtotal;

      const invoiceResult = await sendOrderInvoiceEmail({
        orderId: order.id,
        customerName: order.customerName || 'Valued Customer',
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        shippingMethod: shippingCostVal > 0 ? 'Express Courier Across India' : 'Sector 46 Complimentary Express Delivery',
        subtotal: resolvedSubtotal,
        couponCode: order.couponCode,
        couponDiscount: couponDiscountVal,
        pointsUsed: pointsUsedVal,
        pointsDiscount: pointsDiscountVal,
        shippingCost: shippingCostVal,
        finalTotal: finalPayableVal,
        pointsEarned: order.pointsEarned,
        items: normalizedItems,
        createdAt: order.createdAt,
      });

      order.invoiceSent = true;
      order.invoiceSentAt = order.invoiceSentAt || nowIso;
      order.invoiceStatus = 'generated';
      order.invoiceMessage = `Official sale invoice (${order.invoiceNumber}) generated & sent to ${order.customerEmail || 'registered customer email'}.`;
      if (invoiceResult) {
        order.invoiceResult = {
          success: invoiceResult.success,
          sentViaSmtp: invoiceResult.sentViaSmtp,
          recipients: invoiceResult.recipients,
          gmailComposeUrl: invoiceResult.gmailComposeUrl,
        };
        console.log(`[SALE INVOICE] Generated (${order.invoiceNumber}) and dispatched for confirmed Order #${order.id}`);
      }
      return invoiceResult;
    } catch (err: any) {
      console.warn(`[SALE INVOICE] Failed to dispatch sale invoice for Order #${order?.id}:`, err?.message || err);
      return null;
    }
  }

  app.post('/api/orders', async (req, res) => {
    const newOrder = req.body;
    if (!newOrder || !newOrder.id) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    if (!newOrder.timeline || !Array.isArray(newOrder.timeline) || newOrder.timeline.length === 0) {
      newOrder.timeline = [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          title: 'Order Placed',
          description: 'Your invoice will be generated and available once your order is confirmed.'
        }
      ];
    }

    if (!newOrder.trackingNumber) {
      newOrder.trackingNumber = `CN-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Calculate earned loyalty points (5 pts / ₹100 excluding delivery) - credited ONLY upon delivery
    const shippingCostVal = Number(newOrder.shippingCost) || 0;
    const eligibleOrderAmount = Math.max(0, (Number(newOrder.totalAmount) || Number(newOrder.subtotal) || 0) - shippingCostVal);
    const earnedPts = typeof newOrder.pointsEarned === 'number' && newOrder.pointsEarned > 0
      ? newOrder.pointsEarned
      : calculateEarnedPoints(eligibleOrderAmount);

    newOrder.pointsEarned = earnedPts;

    // Check if this order ID already exists in db.orders (e.g. synced from saveAllOrdersApi)
    const existingOrderIdx = db.orders.findIndex((o) => o && o.id === newOrder.id);
    if (existingOrderIdx >= 0) {
      const prevOrder = db.orders[existingOrderIdx];
      const preservedStatus = newOrder.status || prevOrder.status || 'pending';
      db.orders[existingOrderIdx] = {
        ...prevOrder,
        ...newOrder,
        status: preservedStatus,
        pointsCredited: preservedStatus === 'delivered' ? Boolean(prevOrder.pointsCredited || newOrder.pointsCredited) : false,
      };
      saveDatabase();
      return res.status(200).json(db.orders[existingOrderIdx]);
    }

    // New order starts as pending; earned points are NOT credited until delivered
    newOrder.pointsCredited = false;

    // Immediately deduct redeemed loyalty points across candidate keys (phone, email, userId) - Max 250 pts redemption per order
    const pointsUsedVal = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, Math.max(0, Number(newOrder.pointsUsed) || 0));

    if (pointsUsedVal > 0) {
      if (!db.loyaltyAccounts) db.loyaltyAccounts = {};
      if (!db.loyaltyTransactions) db.loyaltyTransactions = [];

      const candidateKeys: string[] = [];
      if (newOrder.customerPhone) candidateKeys.push(sanitizeLoyaltyKey(newOrder.customerPhone));
      if (newOrder.customerEmail) candidateKeys.push(sanitizeLoyaltyKey(newOrder.customerEmail));
      if (newOrder.userId) candidateKeys.push(sanitizeLoyaltyKey(newOrder.userId));
      if (candidateKeys.length === 0) candidateKeys.push('guest_default_wallet');

      const uniqueKeys = Array.from(new Set(candidateKeys.filter(Boolean)));
      const now = Date.now();

      uniqueKeys.forEach((accKey) => {
        const existingAcc = db.loyaltyAccounts![accKey] || {
          id: accKey,
          customerName: newOrder.customerName || 'Cotton Nest Client',
          phone: newOrder.customerPhone,
          email: newOrder.customerEmail,
          userId: newOrder.userId,
          pointsBalance: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0,
          referralPointsEarned: 0,
          referralCode: generateReferralCode(newOrder.customerName || accKey),
          referralCount: 0,
          updatedAt: now,
        };

        const prevEarned = existingAcc.lifetimeEarned || 0;
        const prevSpent = existingAcc.lifetimeSpent || 0;
        let newSpent = prevSpent;

        const existingRedeemTx = db.loyaltyTransactions!.find(
          (t) => t.accountId === accKey && t.orderId === newOrder.id && (t.type === 'redeemed' || t.points < 0)
        );
        if (!existingRedeemTx) {
          newSpent = prevSpent + pointsUsedVal;
          db.loyaltyTransactions!.unshift({
            id: `tx_redeem_${newOrder.id}_${accKey}_${now}`,
            accountId: accKey,
            orderId: newOrder.id,
            type: 'redeemed',
            points: -pointsUsedVal,
            amountInr: calculatePointsDiscount(pointsUsedVal),
            description: `Redeemed ${pointsUsedVal} Nest Points on Order #${newOrder.id}`,
            createdAt: now,
            status: 'credited',
          });
        }

        const newBal = Math.max(0, prevEarned - newSpent);

        db.loyaltyAccounts![accKey] = {
          ...existingAcc,
          pointsBalance: newBal,
          lifetimeEarned: prevEarned,
          lifetimeSpent: newSpent,
          phone: existingAcc.phone || newOrder.customerPhone,
          email: existingAcc.email || newOrder.customerEmail,
          updatedAt: now,
        };
      });
    }

    // Rule 1 & 6: Never generate or send an invoice when an order is placed.
    // Invoice is generated and emailed strictly when Admin changes order status to 'confirmed'.
    newOrder.status = 'pending';
    newOrder.invoiceGenerated = false;
    newOrder.invoiceSent = false;
    newOrder.invoiceStatus = 'pending_confirmation';
    newOrder.invoiceMessage = 'Your invoice will be generated and available once your order is confirmed.';
    console.log(`[ORDER CREATED] Order #${newOrder.id} placed (pending). Invoice will be generated only after Admin confirmation.`);

    db.orders.unshift(newOrder);
    saveDatabase();

    res.status(201).json(newOrder);
  });

  app.post('/api/send-invoice', async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || !payload.orderId) {
        return res.status(400).json({ success: false, error: 'Invalid invoice payload' });
      }

      const rawId = String(payload.orderId);
      const existingOrder = db.orders.find(
        (o) =>
          o.id === rawId ||
          o.id === `CN-${rawId}` ||
          `CN-${o.id}` === rawId ||
          (o.id && rawId && o.id.replace(/\D/g, '') === rawId.replace(/\D/g, ''))
      );

      const effectiveStatus = String(existingOrder?.status || payload.status || 'pending').toLowerCase();

      // Rule 8: If cancelled before confirmation, no invoice should be generated
      if (
        effectiveStatus === 'cancelled' &&
        !existingOrder?.invoiceGenerated &&
        !existingOrder?.invoiceSent &&
        existingOrder?.invoiceStatus !== 'generated'
      ) {
        return res.status(400).json({
          success: false,
          error: 'This order was cancelled before confirmation. No invoice was generated.',
        });
      }

      // Rule 1, 2, 6: Reject invoice generation/sending before order is confirmed
      if (!['confirmed', 'dispatched', 'delivered'].includes(effectiveStatus)) {
        return res.status(400).json({
          success: false,
          error: 'Your invoice will be generated and available once your order is confirmed.',
        });
      }

      // Rule 7: Prevent duplicate invoice generation or duplicate email sending unless explicitly forced
      if (
        existingOrder &&
        (existingOrder.invoiceGenerated || existingOrder.invoiceSent || existingOrder.invoiceStatus === 'generated') &&
        !payload.forceResend
      ) {
        return res.status(200).json({
          success: true,
          alreadySent: true,
          sentViaSmtp: Boolean(existingOrder.invoiceResult?.sentViaSmtp),
          recipients: existingOrder.invoiceResult?.recipients || (existingOrder.customerEmail ? [existingOrder.customerEmail] : []),
          invoiceNumber: existingOrder.invoiceNumber,
          message: 'Invoice was already generated and sent upon order confirmation.',
        });
      }

      if (existingOrder) {
        const result = await dispatchOrderSaleInvoice(existingOrder, {
          forceResend: Boolean(payload.forceResend),
        });
        saveDatabase();
        return res.status(result?.success === false ? 500 : 200).json(
          result || { success: false, error: 'Failed to generate invoice' }
        );
      }

      const result = await sendOrderInvoiceEmail(payload);
      res.status(result.success ? 200 : 500).json(result);
    } catch (err: any) {
      console.error('Error sending invoice on server:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to send invoice' });
    }
  });

  app.get('/api/invoice-preview/:orderId?', (req, res) => {
    try {
      const orderId = req.params.orderId;
      if (!orderId) {
        return res.status(400).send('Order ID is required to view an invoice.');
      }
      const order = db.orders.find(
        (o) =>
          o.id === orderId ||
          o.id === `CN-${orderId}` ||
          `CN-${o.id}` === orderId ||
          (o.id && orderId && o.id.replace(/\D/g, '') === orderId.replace(/\D/g, ''))
      );
      if (!order) {
        return res.status(404).send('Order not found.');
      }

      const currentStatus = String(order.status || 'pending').toLowerCase();
      if (
        currentStatus === 'cancelled' &&
        !order.invoiceGenerated &&
        !order.invoiceSent &&
        order.invoiceStatus !== 'generated'
      ) {
        return res
          .status(403)
          .send('This order was cancelled before confirmation. No invoice was generated.');
      }

      if (!['confirmed', 'dispatched', 'delivered'].includes(currentStatus)) {
        return res
          .status(403)
          .send('Your invoice will be generated and available once your order is confirmed.');
      }

      const normalizedItems = Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            name: it.product?.name || it.productName || it.name || 'Pure Cotton Bedsheet',
            variantName: it.selectedVariant?.name || it.variantName,
            dimensions: it.product?.dimensions || it.dimensions || '108 x 108 inches',
            quantity: Number(it.quantity) || 1,
            price: Number(it.product?.price) || Number(it.price) || 0,
            imageUrl: it.selectedVariant?.image || it.product?.image || it.productImage || it.imageUrl || '',
          }))
        : [];
      const itemsSubtotal = normalizedItems.reduce(
        (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const couponDiscountVal = Number(order.couponDiscount) || 0;
      const pointsUsedVal = Number(order.pointsUsed) || 0;
      const pointsDiscountVal =
        Number(order.pointsDiscount) || (pointsUsedVal > 0 ? calculatePointsDiscount(pointsUsedVal) : 0);
      const shippingCostVal = Number(order.shippingCost) || 0;
      const finalPayableVal = Number(order.totalAmount) || 0;
      const resolvedSubtotal =
        itemsSubtotal > 0
          ? itemsSubtotal
          : Number(order.subtotal) > finalPayableVal
          ? Number(order.subtotal)
          : finalPayableVal + couponDiscountVal + pointsDiscountVal - shippingCostVal;

      const html = buildCottonNestInvoiceHtml({
        orderId: order.id,
        customerName: order.customerName || 'Valued Customer',
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        shippingMethod: shippingCostVal > 0 ? 'Express Courier Across India' : 'Sector 46 Complimentary Express Delivery',
        subtotal: resolvedSubtotal,
        couponCode: order.couponCode,
        couponDiscount: couponDiscountVal,
        pointsUsed: pointsUsedVal,
        pointsDiscount: pointsDiscountVal,
        shippingCost: shippingCostVal,
        finalTotal: finalPayableVal,
        pointsEarned: order.pointsEarned,
        items: normalizedItems,
        createdAt: order.createdAt,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      res.status(500).send(`Failed to generate preview: ${err.message}`);
    }
  });

  app.put('/api/orders', async (req, res) => {
    if (Array.isArray(req.body)) {
      db.orders = req.body.map((updated: any) => {
        const prev = db.orders.find((o) => o && o.id === updated?.id);
        if (prev) {
          return {
            ...prev,
            ...updated,
            // Preserve existing invoice state so bulk sync never resets or duplicates invoices
            invoiceNumber: prev.invoiceNumber || updated.invoiceNumber,
            invoiceGenerated: Boolean(prev.invoiceGenerated || updated.invoiceGenerated),
            invoiceGeneratedAt: prev.invoiceGeneratedAt || updated.invoiceGeneratedAt,
            invoiceSent: Boolean(prev.invoiceSent || updated.invoiceSent),
            invoiceSentAt: prev.invoiceSentAt || updated.invoiceSentAt,
            invoiceStatus:
              prev.invoiceStatus === 'generated'
                ? 'generated'
                : updated.invoiceStatus || prev.invoiceStatus || 'pending_confirmation',
            invoiceMessage: prev.invoiceMessage || updated.invoiceMessage,
          };
        }
        return updated;
      });
      saveDatabase();
      return res.json(db.orders);
    }
    res.status(400).json({ error: 'Invalid orders payload' });
  });

  app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    let index = db.orders.findIndex(
      (o) => o.id === id || o.id === `CN-${id}` || `CN-${o.id}` === id || (o.id && id && o.id.replace(/\D/g, '') === id.replace(/\D/g, ''))
    );
    if (index === -1) {
      const payloadOrder = updated.order || updated;
      const createdObj = {
        id: id.startsWith('CN-') ? id : `CN-${id}`,
        ...payloadOrder,
        status: updated.status || payloadOrder.status || 'pending',
        customerName: payloadOrder.customerName || 'Valued Customer',
        customerEmail: payloadOrder.customerEmail || 'adityaa.451485@gmail.com',
        customerPhone: payloadOrder.customerPhone || '',
        customerAddress: payloadOrder.customerAddress || 'Sector 46, Gurgaon',
        subtotal: Number(payloadOrder.subtotal) || Number(payloadOrder.totalAmount) || 0,
        totalAmount: Number(payloadOrder.totalAmount) || 0,
        couponCode: payloadOrder.couponCode,
        couponDiscount: Number(payloadOrder.couponDiscount) || 0,
        pointsUsed: Number(payloadOrder.pointsUsed) || 0,
        pointsDiscount: Number(payloadOrder.pointsDiscount) || 0,
        shippingCost: Number(payloadOrder.shippingCost) || 0,
        pointsEarned: payloadOrder.pointsEarned,
        items: payloadOrder.items || [],
        createdAt: payloadOrder.createdAt || new Date().toISOString(),
        timeline: payloadOrder.timeline || [],
      };
      db.orders.unshift(createdObj);
      index = 0;
    }

    const previousOrder = db.orders[index];
    const newStatus = updated.status || previousOrder.status;

    // If status has changed, automatically append to timeline if not already there
    let updatedTimeline = updated.timeline || previousOrder.timeline || [];
    if (newStatus && newStatus !== previousOrder.status) {
      const titles: Record<string, { title: string; description: string }> = {
        pending: {
          title: 'Order Received',
          description: 'Order queued for verification. Sale invoice will generate once confirmed.'
        },
        confirmed: {
          title: 'Order Confirmed & Sale Invoice Generated',
          description: 'Inspected and confirmed by Cotton Nest Atelier. Official sale invoice dispatched to customer email.'
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

    // Automatic refund of redeemed points if order is cancelled
    const isBecomingCancelled = newStatus === 'cancelled' && previousOrder.status !== 'cancelled';
    let pointsRefundedFlag = Boolean(previousOrder.pointsRefunded);

    if (isBecomingCancelled && !pointsRefundedFlag) {
      const ptsUsed = Number(previousOrder.pointsUsed) || 0;
      if (ptsUsed > 0) {
        const loyaltyAccountsMap = db.loyaltyAccounts || (db.loyaltyAccounts = {});
        const loyaltyTransactionsList = db.loyaltyTransactions || (db.loyaltyTransactions = []);

        const candidateKeys: string[] = [];
        if (previousOrder.customerPhone) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.customerPhone));
        if (previousOrder.customerEmail) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.customerEmail));
        if (previousOrder.userId) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.userId));

        const uniqueKeys = Array.from(new Set(candidateKeys.filter(Boolean)));
        const now = Date.now();

        const alreadyRefunded = loyaltyTransactionsList.some(
          (t) => t.orderId === id && t.type === 'refund' && t.points > 0
        );

        if (!alreadyRefunded) {
          uniqueKeys.forEach((accKey) => {
            const existingAcc = loyaltyAccountsMap[accKey];
            if (existingAcc) {
              const currentSpent = existingAcc.lifetimeSpent || 0;
              const newSpent = Math.max(0, currentSpent - ptsUsed);
              const newEarned = existingAcc.lifetimeEarned || 0;
              const newBal = Math.max(0, newEarned - newSpent);

              loyaltyAccountsMap[accKey] = {
                ...existingAcc,
                lifetimeSpent: newSpent,
                pointsBalance: newBal,
                updatedAt: now,
              };

              loyaltyTransactionsList.unshift({
                id: `tx_refund_${id}_${accKey}_${now}`,
                accountId: accKey,
                orderId: id,
                type: 'refund',
                points: ptsUsed,
                amountInr: calculatePointsDiscount(ptsUsed),
                description: `Refund of ${ptsUsed} Nest Points for cancelled Order #${id}`,
                createdAt: now,
                status: 'credited',
              });
            }
          });
        }
        pointsRefundedFlag = true;
      }
    }

    // Credit Nest Points only upon successful delivery and full payment (excluding delivery charges)
    let pointsCreditedFlag = false;

    if (newStatus === 'delivered') {
      const shippingCostVal = Number(previousOrder.shippingCost ?? updated.shippingCost) || 0;
      const eligibleOrderAmount = Math.max(
        0,
        (Number(previousOrder.totalAmount ?? updated.totalAmount) || Number(previousOrder.subtotal ?? updated.subtotal) || 0) - shippingCostVal
      );
      const earnedPts =
        typeof previousOrder.pointsEarned === 'number' && previousOrder.pointsEarned > 0
          ? previousOrder.pointsEarned
          : typeof updated.pointsEarned === 'number' && updated.pointsEarned > 0
          ? updated.pointsEarned
          : calculateEarnedPoints(eligibleOrderAmount);

      previousOrder.pointsEarned = earnedPts;

      if (earnedPts > 0) {
        const loyaltyAccountsMap = db.loyaltyAccounts || (db.loyaltyAccounts = {});
        const loyaltyTransactionsList = db.loyaltyTransactions || (db.loyaltyTransactions = []);

        // Collect all candidate keys (phone, email, userId) to ensure points reflect whether customer logs in by phone or email
        const candidateKeys: string[] = [];
        if (previousOrder.customerPhone) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.customerPhone));
        if (previousOrder.customerEmail) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.customerEmail));
        if (previousOrder.userId) candidateKeys.push(sanitizeLoyaltyKey(previousOrder.userId));
        if (updated.customerPhone) candidateKeys.push(sanitizeLoyaltyKey(updated.customerPhone));
        if (updated.customerEmail) candidateKeys.push(sanitizeLoyaltyKey(updated.customerEmail));
        if (updated.userId) candidateKeys.push(sanitizeLoyaltyKey(updated.userId));
        if (candidateKeys.length === 0) candidateKeys.push('guest_default_wallet');

        const uniqueKeys = Array.from(new Set(candidateKeys.filter(Boolean)));
        const now = Date.now();
        const expiry = getTransactionExpiryDate(now);
        const canonicalOrderId = previousOrder.id || id;

        uniqueKeys.forEach((accKey) => {
          const alreadyCreditedForKey = loyaltyTransactionsList.some(
            (t) =>
              t.accountId === accKey &&
              (t.orderId === canonicalOrderId || t.orderId === id) &&
              t.type === 'earned' &&
              t.points > 0
          );

          if (!alreadyCreditedForKey) {
            const existingAcc = loyaltyAccountsMap[accKey] || {
              id: accKey,
              customerName: previousOrder.customerName || updated.customerName || 'Cotton Nest Client',
              phone: previousOrder.customerPhone || updated.customerPhone,
              email: previousOrder.customerEmail || updated.customerEmail,
              userId: previousOrder.userId || updated.userId,
              pointsBalance: 0,
              lifetimeEarned: 0,
              lifetimeSpent: 0,
              referralCode: generateReferralCode(previousOrder.customerName || accKey),
              updatedAt: now,
            };

            const nextLifetimeEarned = (existingAcc.lifetimeEarned || 0) + earnedPts;
            const currentLifetimeSpent = existingAcc.lifetimeSpent || 0;
            const nextPointsBalance = Math.max(0, nextLifetimeEarned - currentLifetimeSpent);

            loyaltyAccountsMap[accKey] = {
              ...existingAcc,
              pointsBalance: nextPointsBalance,
              lifetimeEarned: nextLifetimeEarned,
              phone: existingAcc.phone || previousOrder.customerPhone || updated.customerPhone,
              email: existingAcc.email || previousOrder.customerEmail || updated.customerEmail,
              updatedAt: now,
            };

            loyaltyTransactionsList.unshift({
              id: `tx_earn_${canonicalOrderId}_${accKey}_${now}`,
              accountId: accKey,
              orderId: canonicalOrderId,
              type: 'earned',
              points: earnedPts,
              amountInr: eligibleOrderAmount,
              description: `Earned on Delivered Order #${canonicalOrderId} (5 pts / ₹100)`,
              createdAt: now,
              expiresAt: expiry,
              status: 'credited',
            });
          }
        });
      }
      pointsCreditedFlag = true;
    }

    // Check if an invoice was ALREADY generated for this order before this update
    const alreadyHadInvoice = Boolean(
      previousOrder.invoiceGenerated ||
        previousOrder.invoiceSent ||
        previousOrder.invoiceStatus === 'generated'
    );

    // Rule 2 & 7: Generate invoice ONLY when Admin changes status to 'confirmed' and it hasn't been generated yet
    const shouldGenerateInvoiceNow = newStatus === 'confirmed' && !alreadyHadInvoice;

    // Rule 8: If cancelled before confirmation, mark that no invoice should be generated
    const isCancelledBeforeConfirmation = newStatus === 'cancelled' && !alreadyHadInvoice;

    const deliveredAtTimestamp =
      newStatus === 'delivered'
        ? updated.deliveredAt || previousOrder.deliveredAt || new Date().toISOString()
        : previousOrder.deliveredAt;

    const payloadOrderFields = updated.order && typeof updated.order === 'object' ? updated.order : {};
    const { order: _omittedNestedOrder, ...topLevelUpdated } = updated;

    db.orders[index] = {
      ...previousOrder,
      ...payloadOrderFields,
      ...topLevelUpdated,
      status: newStatus,
      pointsEarned: previousOrder.pointsEarned || updated.pointsEarned || payloadOrderFields.pointsEarned,
      ...(deliveredAtTimestamp ? { deliveredAt: deliveredAtTimestamp } : {}),
      pointsCredited: pointsCreditedFlag || Boolean(previousOrder.pointsCredited && newStatus === 'delivered'),
      pointsRefunded: pointsRefundedFlag,
      timeline: updatedTimeline,
      // Preserve existing invoice fields if already generated
      invoiceNumber: previousOrder.invoiceNumber || payloadOrderFields.invoiceNumber,
      invoiceGenerated: alreadyHadInvoice,
      invoiceGeneratedAt: previousOrder.invoiceGeneratedAt || payloadOrderFields.invoiceGeneratedAt,
      invoiceSent: alreadyHadInvoice,
      invoiceSentAt: previousOrder.invoiceSentAt || payloadOrderFields.invoiceSentAt,
      invoiceStatus: alreadyHadInvoice
        ? 'generated'
        : isCancelledBeforeConfirmation
        ? 'cancelled_before_confirmation'
        : 'pending_confirmation',
      invoiceMessage: alreadyHadInvoice
        ? previousOrder.invoiceMessage
        : isCancelledBeforeConfirmation
        ? 'Order was cancelled before confirmation. No invoice was generated.'
        : 'Your invoice will be generated and available once your order is confirmed.',
    };

    if (shouldGenerateInvoiceNow) {
      await dispatchOrderSaleInvoice(db.orders[index]);
    }

    // If status changed on order, record an order status notification
    if (newStatus && newStatus !== previousOrder.status) {
      if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
      const isConfirmed = newStatus === 'confirmed';
      const orderNotif: AppNotification = {
        id: `notif-order-${id}-${newStatus}-${Date.now()}`,
        recipientId: previousOrder.customerEmail || previousOrder.customerPhone || 'all',
        type: 'order_status',
        category: 'orders',
        title: isConfirmed ? `Order #${id} Confirmed - Sale Invoice Generated` : `Order #${id} Updated: ${String(newStatus).toUpperCase()}`,
        message: isConfirmed
          ? `Your Cotton Nest order #${id} has been confirmed. Your official sale invoice has been generated and sent to your registered email.`
          : `Your Cotton Nest order #${id} is now ${newStatus}.`,
        timestamp: Date.now(),
        isRead: false,
        linkTarget: {
          view: 'orders',
          targetId: id,
        },
        metadata: {
          orderId: id,
          customerName: previousOrder.customerName,
          customerPhone: previousOrder.customerPhone,
          customerEmail: previousOrder.customerEmail,
        },
      };
      db.notifications.unshift(orderNotif);
    }

    saveDatabase();
    res.json(db.orders[index]);
  });

  app.post('/api/orders/:id/confirm', async (req, res) => {
    const { id } = req.params;
    let index = db.orders.findIndex(
      (o) => o.id === id || o.id === `CN-${id}` || `CN-${o.id}` === id || (o.id && id && o.id.replace(/\D/g, '') === id.replace(/\D/g, ''))
    );
    if (index === -1) {
      const payloadOrder = req.body?.order || req.body || {};
      const createdObj = {
        id: id.startsWith('CN-') ? id : `CN-${id}`,
        ...payloadOrder,
        status: 'confirmed',
        customerName: payloadOrder.customerName || 'Valued Customer',
        customerEmail: payloadOrder.customerEmail || 'adityaa.451485@gmail.com',
        customerPhone: payloadOrder.customerPhone || '',
        customerAddress: payloadOrder.customerAddress || 'Sector 46, Gurgaon',
        subtotal: Number(payloadOrder.subtotal) || Number(payloadOrder.totalAmount) || 0,
        totalAmount: Number(payloadOrder.totalAmount) || 0,
        couponCode: payloadOrder.couponCode,
        couponDiscount: Number(payloadOrder.couponDiscount) || 0,
        pointsUsed: Number(payloadOrder.pointsUsed) || 0,
        pointsDiscount: Number(payloadOrder.pointsDiscount) || 0,
        shippingCost: Number(payloadOrder.shippingCost) || 0,
        pointsEarned: payloadOrder.pointsEarned,
        items: payloadOrder.items || [],
        createdAt: payloadOrder.createdAt || new Date().toISOString(),
      };
      db.orders.unshift(createdObj);
      index = 0;
    }

    db.orders[index].status = 'confirmed';
    const invoiceResult = await dispatchOrderSaleInvoice(db.orders[index]);
    saveDatabase();
    res.json({
      success: true,
      order: db.orders[index],
      invoiceResult,
    });
  });

  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    db.orders = db.orders.filter((o) => o.id !== id);
    saveDatabase();
    res.json({ success: true, id });
  });

  /* ------------------- SMART WISHLIST NOTIFICATIONS API ------------------- */
  function getISTHour(timestamp: number = Date.now()): number {
    const date = new Date(timestamp);
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 3600000;
    return new Date(istMs).getHours();
  }

  function isQuietHours(timestamp: number = Date.now(), startHour = 21, endHour = 9): boolean {
    const hour = getISTHour(timestamp);
    if (startHour > endHour) {
      return hour >= startHour || hour < endHour;
    }
    return hour >= startHour && hour < endHour;
  }

  app.get('/api/wishlist-notification-settings', (_req, res) => {
    if (!db.wishlistNotificationSettings) {
      db.wishlistNotificationSettings = {
        enabled: true,
        dailyLimit: 1,
        weeklyLimit: 3,
        quietHoursStart: 21, // 9 PM IST
        quietHoursEnd: 9,   // 9 AM IST
        cooldownHours: 48,
      };
    }
    res.json(db.wishlistNotificationSettings);
  });

  app.put('/api/wishlist-notification-settings', (req, res) => {
    const payload = req.body || {};
    db.wishlistNotificationSettings = {
      enabled: Boolean(payload.enabled ?? true),
      dailyLimit: Number(payload.dailyLimit ?? 1),
      weeklyLimit: Number(payload.weeklyLimit ?? 3),
      quietHoursStart: Number(payload.quietHoursStart ?? 21),
      quietHoursEnd: Number(payload.quietHoursEnd ?? 9),
      cooldownHours: Number(payload.cooldownHours ?? 48),
    };
    saveDatabase();
    res.json(db.wishlistNotificationSettings);
  });

  app.get('/api/wishlist-notification-history', (_req, res) => {
    if (!db.wishlistNotificationHistories) db.wishlistNotificationHistories = {};
    res.json(db.wishlistNotificationHistories);
  });

  app.post('/api/wishlist-notification-history', (req, res) => {
    const payload = req.body || {};
    const userId = payload.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!db.wishlistNotificationHistories) db.wishlistNotificationHistories = {};
    const existing = db.wishlistNotificationHistories[userId] || {
      userId,
      lastNotificationTimestamp: 0,
      notificationCountLast7Days: 0,
      recentTimestamps: [],
      lastNotificationType: 'wishlist_reminder',
      status: 'pending',
    };

    db.wishlistNotificationHistories[userId] = {
      ...existing,
      ...payload,
      userId,
    };
    saveDatabase();
    res.json(db.wishlistNotificationHistories[userId]);
  });

  app.post('/api/wishlist-reminders/evaluate', (req, res) => {
    const { userId, wishlistItems, orders } = req.body || {};
    if (!userId) {
      return res.status(400).json({ canSend: false, reason: 'userId is required' });
    }

    if (!db.wishlistNotificationSettings) {
      db.wishlistNotificationSettings = {
        enabled: true,
        dailyLimit: 1,
        weeklyLimit: 3,
        quietHoursStart: 21,
        quietHoursEnd: 9,
        cooldownHours: 48,
      };
    }

    const settings = db.wishlistNotificationSettings;
    if (!settings.enabled) {
      return res.json({ canSend: false, reason: 'Wishlist reminders are disabled in admin settings.' });
    }

    // 1. Quiet Hours check (9 PM to 9 AM IST)
    const now = Date.now();
    const isQuiet = isQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd);
    if (isQuiet) {
      return res.json({ canSend: false, reason: 'Current time is within quiet hours (9 PM to 9 AM IST).' });
    }

    // 2. Wishlist validation: contains at least one valid product, in stock, not already purchased
    const items = Array.isArray(wishlistItems) ? wishlistItems : [];
    if (items.length === 0) {
      return res.json({ canSend: false, reason: 'Wishlist is empty.' });
    }

    const purchasedProductIds = new Set<string>();
    const allOrders = Array.isArray(orders) ? orders : (db.orders || []);
    allOrders.forEach((o: any) => {
      if (o && o.status !== 'cancelled' && Array.isArray(o.items)) {
        o.items.forEach((it: any) => {
          if (it && it.productId) purchasedProductIds.add(it.productId);
        });
      }
    });

    const validItems = items.filter((item: any) => {
      if (!item || !item.productId) return false;
      if (purchasedProductIds.has(item.productId)) return false; // already purchased
      const product = (db.products || []).find((p: any) => p.id === item.productId);
      if (!product) return false;
      const inStock = product.inStock !== false && (product.stockQuantity === undefined || product.stockQuantity > 0);
      return inStock;
    });

    if (validItems.length === 0) {
      return res.json({ canSend: false, reason: 'No eligible in-stock unpurchased items in wishlist.' });
    }

    // 3. Frequency & Cooldown check
    if (!db.wishlistNotificationHistories) db.wishlistNotificationHistories = {};
    const history = db.wishlistNotificationHistories[userId] || {
      userId,
      lastNotificationTimestamp: 0,
      notificationCountLast7Days: 0,
      recentTimestamps: [],
      lastNotificationType: 'wishlist_reminder',
      status: 'pending',
    };

    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const oneDayAgo = now - 24 * 3600 * 1000;
    const cooldownMs = (settings.cooldownHours || 48) * 3600 * 1000;

    const recent7Days = (history.recentTimestamps || []).filter((t: number) => t > sevenDaysAgo);

    if (recent7Days.length >= settings.weeklyLimit) {
      return res.json({ canSend: false, reason: `Weekly limit of ${settings.weeklyLimit} reminders reached in the last 7 days.` });
    }

    if (history.lastNotificationTimestamp && history.lastNotificationTimestamp > oneDayAgo) {
      return res.json({ canSend: false, reason: 'Daily limit of 1 reminder every 24 hours reached.' });
    }

    if (history.interactionTimestamp && now - history.interactionTimestamp < cooldownMs) {
      return res.json({ canSend: false, reason: `Active ${settings.cooldownHours}-hour click cooldown in effect.` });
    }

    // Passes all checks! Record notification sent atomically
    recent7Days.push(now);
    const updatedHistory = {
      ...history,
      lastNotificationTimestamp: now,
      notificationCountLast7Days: recent7Days.length,
      recentTimestamps: recent7Days,
      lastNotificationType: 'wishlist_reminder',
      status: 'sent' as const,
    };

    db.wishlistNotificationHistories[userId] = updatedHistory;
    saveDatabase();

    return res.json({ canSend: true, history: updatedHistory, validItemsCount: validItems.length });
  });

  /* ------------------- NOTIFICATIONS API ------------------- */
  app.get('/api/notifications', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
    const sorted = [...db.notifications].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    res.json(sorted);
  });

  app.post('/api/notifications', (req, res) => {
    if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
    const notif = req.body as AppNotification;
    if (!notif || !notif.id || !notif.title) {
      return res.status(400).json({ error: 'Valid notification object is required.' });
    }
    const stamped: AppNotification = {
      ...notif,
      timestamp: notif.timestamp || Date.now(),
      isRead: Boolean(notif.isRead),
    };
    const idx = db.notifications.findIndex((n) => n.id === stamped.id);
    if (idx >= 0) {
      db.notifications[idx] = stamped;
    } else {
      db.notifications.unshift(stamped);
    }
    saveDatabase();
    return res.status(201).json(stamped);
  });

  app.patch('/api/notifications/:id', (req, res) => {
    if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
    const { id } = req.params;
    const idx = db.notifications.findIndex((n) => n.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    db.notifications[idx] = {
      ...db.notifications[idx],
      ...req.body,
    };
    saveDatabase();
    return res.json(db.notifications[idx]);
  });

  app.post('/api/notifications/mark-all-read', (_req, res) => {
    if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
    db.notifications = db.notifications.map((n) => ({ ...n, isRead: true }));
    saveDatabase();
    return res.json({ success: true });
  });

  app.delete('/api/notifications', (_req, res) => {
    db.notifications = [];
    saveDatabase();
    return res.json({ success: true });
  });

  /* ------------------- RETURN / EXCHANGE / COMPLAINTS API ------------------- */

  // 1. Get complaints (all for admin, or filtered by orderId / customer identity)
  app.get('/api/complaints', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!db.complaints) db.complaints = [];

    const { orderId, email, phone, userId } = req.query as Record<string, string | undefined>;
    let list = [...db.complaints];

    if (orderId) {
      const targetOrder = orderId.trim().toLowerCase();
      list = list.filter((c) => c.orderId?.toLowerCase() === targetOrder);
      return res.json(
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }

    if (email || phone || userId) {
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const cleanPhone = normalizePhoneDigits(phone);
      const cleanUserId = userId ? userId.trim() : '';

      list = list.filter((c) => {
        const cEmail = c.customerEmail ? c.customerEmail.trim().toLowerCase() : '';
        const cPhone = normalizePhoneDigits(c.customerPhone);
        const cUserId = c.userId ? c.userId.trim() : '';

        const matchesEmail = Boolean(cleanEmail && cEmail && cEmail === cleanEmail);
        const matchesPhone = Boolean(cleanPhone && cPhone && cPhone === cleanPhone);
        const matchesUserId = Boolean(cleanUserId && cUserId && cUserId === cleanUserId);

        return matchesEmail || matchesPhone || matchesUserId;
      });
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  });

  // 2. Submit a new Return / Exchange / Product Complaint (verifies order ownership & product membership)
  app.post('/api/complaints', (req, res) => {
    try {
      if (!db.complaints) db.complaints = [];
      if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
      const payload = req.body || {};
      const orderId = String(payload.orderId || '').trim();

      if (!orderId) {
        return res.status(400).json({ error: 'Original orderId is required.' });
      }

      // Find original order in server DB, or hydrate from orderSnapshot if order was created in Firestore
      let order = db.orders.find((o) => o.id?.toLowerCase() === orderId.toLowerCase());
      if (!order && payload.orderSnapshot && payload.orderSnapshot.id === orderId) {
        order = payload.orderSnapshot;
        db.orders.unshift(order);
      }

      const validation = validateComplaintSubmission(payload, order);
      if (!validation.valid || !validation.complaint) {
        return res.status(400).json({
          error: validation.error || 'Complaint validation failed.',
        });
      }

      const newComplaint = validation.complaint;

      // Replace if same complaint ID was retried, otherwise prepend
      const existingIdx = db.complaints.findIndex((c) => c.id === newComplaint.id);
      if (existingIdx >= 0) {
        db.complaints[existingIdx] = newComplaint;
      } else {
        db.complaints.unshift(newComplaint);
      }

      // Automatically record customer and admin notifications on submission
      const customerNotif = buildComplaintNotificationForCustomer(newComplaint, 'submitted');
      const adminNotif = buildComplaintNotificationForAdmin(newComplaint);
      db.notifications.unshift(customerNotif);
      db.notifications.unshift(adminNotif);

      saveDatabase();
      return res.status(201).json(newComplaint);
    } catch (err: any) {
      console.error('Error creating complaint:', err);
      return res.status(500).json({ error: err.message || 'Failed to submit complaint.' });
    }
  });

  // 3. Admin Update Complaint Status & Response
  const handleUpdateComplaint = (req: express.Request, res: express.Response) => {
    try {
      if (!db.complaints) db.complaints = [];
      if (!db.notifications) db.notifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
      const { id } = req.params;
      const body = req.body || {};

      let existingIdx = db.complaints.findIndex((c) => c.id === id);
      if (existingIdx === -1 && body.complaintSnapshot && body.complaintSnapshot.id === id) {
        db.complaints.unshift(body.complaintSnapshot);
        existingIdx = 0;
      }

      if (existingIdx === -1) {
        return res.status(404).json({ error: 'Complaint record not found.' });
      }

      const updateResult = applyAdminComplaintUpdate(db.complaints[existingIdx], {
        status: body.status,
        adminResponse: body.adminResponse,
        respondedBy: body.respondedBy,
      });

      if (!updateResult.valid || !updateResult.complaint) {
        return res.status(400).json({ error: updateResult.error || 'Invalid status update.' });
      }

      db.complaints[existingIdx] = updateResult.complaint;

      // Automatically record a customer notification when admin updates status or responds
      const customerUpdateNotif = buildComplaintNotificationForCustomer(
        updateResult.complaint,
        'admin_update'
      );
      db.notifications.unshift(customerUpdateNotif);

      saveDatabase();
      return res.json(updateResult.complaint);
    } catch (err: any) {
      console.error('Error updating complaint:', err);
      return res.status(500).json({ error: err.message || 'Failed to update complaint.' });
    }
  };

  app.patch('/api/complaints/:id', handleUpdateComplaint);
  app.put('/api/complaints/:id', handleUpdateComplaint);

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
    const rawCoupon = req.body;
    if (!rawCoupon || typeof rawCoupon !== 'object') {
      return res.status(400).json({ error: 'Invalid coupon payload.' });
    }

    const rawCode = String(rawCoupon.code || '').trim().toUpperCase();
    const cleanCode = rawCode.replace(/[^A-Z0-9_-]/g, '-') || `OFFER-${Math.floor(100 + Math.random() * 900)}`;
    const discountVal = Number(rawCoupon.discountValue);

    if (isNaN(discountVal) || discountVal <= 0) {
      return res.status(400).json({ error: 'Discount value must be greater than 0.' });
    }

    const safeId = (
      rawCoupon.id && typeof rawCoupon.id === 'string' && !rawCoupon.id.includes('/')
        ? rawCoupon.id
        : `coupon-${cleanCode.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${Date.now().toString(36)}`
    ).slice(0, 100);

    const coupon: CouponOffer = {
      id: safeId,
      code: cleanCode,
      title: String(rawCoupon.title || '').trim() || `${cleanCode} Offer`,
      description: String(rawCoupon.description || '').trim(),
      discountType: rawCoupon.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: discountVal,
      minOrderValue: Math.max(0, Number(rawCoupon.minOrderValue) || 0),
      maxDiscountAmount: rawCoupon.maxDiscountAmount ? Math.max(0, Number(rawCoupon.maxDiscountAmount)) : 0,
      startDate: String(rawCoupon.startDate || '').trim() || new Date().toISOString().split('T')[0],
      expiryDate: String(rawCoupon.expiryDate || '').trim() || '2030-12-31',
      isActive: rawCoupon.isActive !== false,
      isAutomatic: Boolean(rawCoupon.isAutomatic),
      maxUses: rawCoupon.maxUses ? Math.max(0, Number(rawCoupon.maxUses)) : 0,
      usedCount: Math.max(0, Number(rawCoupon.usedCount) || 0),
      oneUsePerCustomer: Boolean(rawCoupon.oneUsePerCustomer),
      usedByCustomers: Array.isArray(rawCoupon.usedByCustomers) ? rawCoupon.usedByCustomers : [],
      scope: rawCoupon.scope === 'products' ? 'products' : rawCoupon.scope === 'collections' ? 'collections' : 'all',
      applicableProductIds: Array.isArray(rawCoupon.applicableProductIds) ? rawCoupon.applicableProductIds : [],
      applicableCollections: Array.isArray(rawCoupon.applicableCollections) ? rawCoupon.applicableCollections : [],
      badgeText: String(rawCoupon.badgeText || '').trim(),
      createdAt: Number(rawCoupon.createdAt) || Date.now(),
      updatedAt: Date.now(),
    };

    if (!db.coupons) db.coupons = [...INITIAL_COUPONS];
    const existingIdx = db.coupons.findIndex(
      (c) => c.id === coupon.id || c.code.toUpperCase() === coupon.code.toUpperCase()
    );
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

  /* ------------------- CUSTOMER WISHLISTS API ------------------- */

  // 1. Get wishlists (all for admin, or filtered by customerId)
  app.get('/api/wishlists', (req, res) => {
    if (!db.wishlists) db.wishlists = [];
    const customerId = req.query.customerId ? String(req.query.customerId).trim() : null;
    if (customerId) {
      const filtered = db.wishlists.filter((w) => w.customerId === customerId);
      return res.json(filtered);
    }
    res.json(db.wishlists);
  });

  // 2. Add or update wishlist item
  app.post('/api/wishlists', (req, res) => {
    const raw = req.body;
    if (!raw || !raw.productId || !raw.customerId) {
      return res.status(400).json({ error: 'productId and customerId are required.' });
    }

    if (!db.wishlists) db.wishlists = [];

    const itemId = String(raw.id || `${raw.customerId}_${raw.productId}`);
    const item: WishlistItem = {
      id: itemId,
      customerId: String(raw.customerId).trim(),
      customerName: String(raw.customerName || 'Atelier Guest').trim(),
      customerEmail: raw.customerEmail ? String(raw.customerEmail).trim() : undefined,
      customerPhone: raw.customerPhone ? String(raw.customerPhone).trim() : undefined,
      productId: String(raw.productId).trim(),
      productName: String(raw.productName || 'Pure Cotton Bedsheet').trim(),
      productPrice: Number(raw.productPrice) || 0,
      productOriginalPrice: Number(raw.productOriginalPrice) || 0,
      productImage: String(raw.productImage || '').trim(),
      productDimensions: raw.productDimensions ? String(raw.productDimensions).trim() : undefined,
      collection: raw.collection ? String(raw.collection).trim() : undefined,
      threadCount: raw.threadCount ? String(raw.threadCount).trim() : undefined,
      fabric: raw.fabric ? String(raw.fabric).trim() : undefined,
      selectedVariantId: raw.selectedVariantId ? String(raw.selectedVariantId).trim() : undefined,
      selectedVariantName: raw.selectedVariantName ? String(raw.selectedVariantName).trim() : undefined,
      note: raw.note ? String(raw.note).trim() : undefined,
      createdAt: Number(raw.createdAt) || Date.now(),
    };

    const existingIdx = db.wishlists.findIndex((w) => w.id === item.id);
    if (existingIdx >= 0) {
      db.wishlists[existingIdx] = { ...db.wishlists[existingIdx], ...item };
    } else {
      db.wishlists.unshift(item);
    }

    saveDatabase();
    res.status(200).json(item);
  });

  // 3. Delete wishlist item by ID
  app.delete('/api/wishlists/:id', (req, res) => {
    const { id } = req.params;
    if (!db.wishlists) db.wishlists = [];
    db.wishlists = db.wishlists.filter((w) => w.id !== id);
    saveDatabase();
    res.json({ success: true, id });
  });

  // 4. Delete wishlist item by customerId and productId query
  app.delete('/api/wishlists', (req, res) => {
    const { customerId, productId } = req.query;
    if (!customerId || !productId) {
      return res.status(400).json({ error: 'customerId and productId are required query parameters.' });
    }
    if (!db.wishlists) db.wishlists = [];
    db.wishlists = db.wishlists.filter(
      (w) => !(w.customerId === String(customerId) && w.productId === String(productId))
    );
    saveDatabase();
    res.json({ success: true });
  });

  /* ------------------- LOYALTY POINTS & REWARDS API ------------------- */
  // 5 Nest Points per ₹100 spent (no points on delivery charges); 100 points = ₹50 discount at checkout (min 200 pts)

  // 1. Get loyalty account balance and metadata
  app.get('/api/loyalty/:id', (req, res) => {
    const rawId = req.params.id;
    const accountId = sanitizeLoyaltyKey(rawId);
    if (!db.loyaltyAccounts) db.loyaltyAccounts = {};

    let account = db.loyaltyAccounts[accountId];
    if (!account) {
      account = {
        id: accountId,
        pointsBalance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        referralPointsEarned: 0,
        referralCode: generateReferralCode(accountId),
        referralCount: 0,
        updatedAt: Date.now(),
      };
      db.loyaltyAccounts[accountId] = account;
      saveDatabase();
    } else if (!account.referralCode) {
      account.referralCode = generateReferralCode(account.customerName || accountId);
    }

    // Always cross-link phone/email and reconcile delivered orders so newly delivered orders immediately credit
    {
      const cleanRaw = String(rawId).toLowerCase().trim();
      const extractedEmail =
        (account.email || '').toLowerCase().trim() ||
        (cleanRaw.startsWith('email_') ? cleanRaw.slice(6) : cleanRaw.includes('@') ? cleanRaw : '');
      const cleanPhoneDigits = (account.phone || cleanRaw).replace(/[^0-9]/g, '').slice(-10);

      // 1. Search other loyalty accounts with matching email or phone
      for (const [otherKey, otherAcc] of Object.entries(db.loyaltyAccounts)) {
        if (otherKey === accountId || !otherAcc) continue;
        const matchesEmail = Boolean(extractedEmail && otherAcc.email?.toLowerCase().trim() === extractedEmail);
        const matchesPhone = Boolean(cleanPhoneDigits && otherAcc.phone?.replace(/[^0-9]/g, '').endsWith(cleanPhoneDigits));
        if (matchesEmail || matchesPhone) {
          const nextEarned = Math.max(account.lifetimeEarned || 0, otherAcc.lifetimeEarned || 0);
          const safeAccSpent = (account.lifetimeSpent || 0) <= nextEarned ? (account.lifetimeSpent || 0) : 0;
          const safeOtherSpent = (otherAcc.lifetimeSpent || 0) <= nextEarned ? (otherAcc.lifetimeSpent || 0) : 0;
          const nextSpent = Math.max(safeAccSpent, safeOtherSpent);
          const nextBal = Math.max(0, nextEarned - nextSpent);
          if (
            nextBal !== account.pointsBalance ||
            nextEarned !== account.lifetimeEarned ||
            nextSpent !== account.lifetimeSpent
          ) {
            account.lifetimeEarned = nextEarned;
            account.lifetimeSpent = nextSpent;
            account.pointsBalance = nextBal;
            account.phone = account.phone || otherAcc.phone;
            account.email = account.email || otherAcc.email;
            account.updatedAt = Date.now();
            db.loyaltyAccounts[accountId] = account;
            saveDatabase();
          }
          break;
        }
      }

      // 2. Reconcile customer orders: Earned points ONLY from 'delivered' orders; Spent points from non-cancelled orders
      if (Array.isArray(db.orders)) {
        if (!db.loyaltyTransactions) db.loyaltyTransactions = [];
        let earnedFromDeliveredOrders = 0;
        let spentFromOrders = 0;
        let matchedAnyOrder = false;
        let txAdded = false;
        const now = Date.now();
        const expiry = getTransactionExpiryDate(now);

        db.orders.forEach((o) => {
          if (!o || o.status === 'cancelled') return;
          const oEmail = (o.customerEmail || '').toLowerCase().trim();
          const oPhone = (o.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
          const isMatch =
            Boolean(extractedEmail && oEmail === extractedEmail) ||
            Boolean(cleanPhoneDigits && oPhone === cleanPhoneDigits) ||
            Boolean(cleanRaw && (o.userId === cleanRaw || o.userId === accountId)) ||
            accountId === 'guest_default_wallet';

          if (isMatch) {
            matchedAnyOrder = true;
            const ship = Number(o.shippingCost) || 0;
            const net = Math.max(0, (Number(o.totalAmount) || Number(o.subtotal) || 0) - ship);
            const pts = typeof o.pointsEarned === 'number' && o.pointsEarned > 0 ? o.pointsEarned : calculateEarnedPoints(net);

            if (o.status === 'delivered') {
              earnedFromDeliveredOrders += pts;
              o.pointsCredited = true;
              if (pts > 0) {
                const hasTx = db.loyaltyTransactions!.some(
                  (t) => t.accountId === accountId && t.orderId === o.id && t.type === 'earned' && t.points > 0
                );
                if (!hasTx) {
                  db.loyaltyTransactions!.unshift({
                    id: `tx_earn_${o.id}_${accountId}_${now}`,
                    accountId,
                    orderId: o.id,
                    type: 'earned',
                    points: pts,
                    amountInr: net,
                    description: `Earned on Delivered Order #${o.id} (5 pts / ₹100)`,
                    createdAt: o.deliveredAt ? new Date(o.deliveredAt).getTime() || now : now,
                    expiresAt: expiry,
                    status: 'credited',
                  });
                  txAdded = true;
                }
              }
            }
            if (o.pointsUsed && Number(o.pointsUsed) > 0 && Number(o.pointsUsed) <= LOYALTY_MAX_REDEMPTION_POINTS) {
              spentFromOrders += Number(o.pointsUsed);
            }
          }
        });

        if (matchedAnyOrder) {
          const referralBonus = (db.loyaltyTransactions || [])
            .filter((t) => t && t.accountId === accountId && (t.type === 'referral' || t.type === 'bonus') && t.points > 0)
            .reduce((sum, t) => sum + Number(t.points || 0), 0);
          const effectiveReferral = Math.max(account.referralPointsEarned || 0, referralBonus);
          const effectiveEarned = Math.max(account.lifetimeEarned || 0, earnedFromDeliveredOrders + effectiveReferral);
          const safeAccountSpent = (account.lifetimeSpent || 0) <= effectiveEarned ? (account.lifetimeSpent || 0) : 0;
          const effectiveSpent = Math.max(safeAccountSpent, spentFromOrders);
          const computedNet = Math.max(0, effectiveEarned - effectiveSpent);

          if (
            computedNet !== account.pointsBalance ||
            effectiveSpent !== account.lifetimeSpent ||
            effectiveEarned !== account.lifetimeEarned ||
            txAdded
          ) {
            account.lifetimeEarned = effectiveEarned;
            account.lifetimeSpent = effectiveSpent;
            account.pointsBalance = computedNet;
            account.updatedAt = Date.now();
            db.loyaltyAccounts[accountId] = account;
            saveDatabase();
          }
        }
      }
    }

    res.json(account);
  });

  // 2. Earn loyalty points on delivered purchase (5 pts per ₹100, valid for 12 months)
  app.post('/api/loyalty/earn', (req, res) => {
    const { accountId: rawId, points, amountInr, orderId, account, tx } = req.body || {};
    const accountId = sanitizeLoyaltyKey(rawId);

    if (!db.loyaltyAccounts) db.loyaltyAccounts = {};
    if (!db.loyaltyTransactions) db.loyaltyTransactions = [];

    // Avoid duplicate earned transaction for same orderId
    if (orderId && !String(orderId).startsWith('REF-')) {
      const existingTx = db.loyaltyTransactions.find(
        (t) => t.accountId === accountId && t.orderId === orderId && t.type === 'earned' && t.points > 0
      );
      if (existingTx && db.loyaltyAccounts[accountId]) {
        return res.json({
          account: db.loyaltyAccounts[accountId],
          tx: existingTx,
          pointsEarned: existingTx.points,
        });
      }
    }

    const calculatedPoints = typeof points === 'number' ? points : calculateEarnedPoints(amountInr || 0);
    const now = Date.now();
    const existing = db.loyaltyAccounts[accountId] || {
      id: accountId,
      pointsBalance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      referralPointsEarned: 0,
      referralCode: generateReferralCode(accountId),
      updatedAt: now,
    };

    const updatedAccount: LoyaltyAccount = {
      ...existing,
      ...(account || {}),
      id: accountId,
      pointsBalance: (existing.pointsBalance || 0) + calculatedPoints,
      lifetimeEarned: (existing.lifetimeEarned || 0) + calculatedPoints,
      updatedAt: now,
    };

    db.loyaltyAccounts[accountId] = updatedAccount;

    const transaction: LoyaltyTransaction = tx || {
      id: `tx_${now}_${Math.random().toString(36).substring(2, 7)}`,
      accountId,
      orderId: orderId || 'order_unknown',
      type: 'earned',
      points: calculatedPoints,
      amountInr: amountInr || 0,
      description: `Earned on Delivered Order #${orderId || ''} (5 pts / ₹100)`,
      createdAt: now,
      expiresAt: getTransactionExpiryDate(now),
      status: 'credited',
    };

    if (!transaction.expiresAt) {
      transaction.expiresAt = getTransactionExpiryDate(transaction.createdAt || now);
    }

    db.loyaltyTransactions.unshift(transaction);
    saveDatabase();

    res.json({ account: updatedAccount, tx: transaction, pointsEarned: calculatedPoints });
  });

  // 3. Redeem loyalty points as checkout discount (min 200 pts, 100 pts = ₹50)
  app.post('/api/loyalty/redeem', (req, res) => {
    const { accountId: rawId, points, discountInr, orderId, account, tx } = req.body || {};
    const accountId = sanitizeLoyaltyKey(rawId);

    if (!db.loyaltyAccounts) db.loyaltyAccounts = {};
    if (!db.loyaltyTransactions) db.loyaltyTransactions = [];

    const existing = db.loyaltyAccounts[accountId] || {
      id: accountId,
      pointsBalance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      updatedAt: Date.now(),
    };

    const requestedPoints = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, Math.max(0, Number(points) || 0));
    const curEarned = Math.max(existing.lifetimeEarned || 0, account?.lifetimeEarned || 0);
    const curSpent = Math.max(existing.lifetimeSpent || 0, account?.lifetimeSpent || 0);
    const availableToDeduct = Math.max(0, curEarned - curSpent);
    const pointsToDeduct = Math.min(LOYALTY_MAX_REDEMPTION_POINTS, availableToDeduct, requestedPoints > 0 ? requestedPoints : availableToDeduct);
    const effectiveDiscount = discountInr !== undefined ? discountInr : calculatePointsDiscount(pointsToDeduct);

    const newLifetimeSpent = curSpent + pointsToDeduct;
    const newBalance = Math.max(0, curEarned - newLifetimeSpent);

    const updatedAccount: LoyaltyAccount = {
      ...existing,
      ...(account || {}),
      id: accountId,
      lifetimeEarned: curEarned,
      lifetimeSpent: newLifetimeSpent,
      pointsBalance: newBalance,
      updatedAt: Date.now(),
    };

    db.loyaltyAccounts[accountId] = updatedAccount;

    const transaction: LoyaltyTransaction = tx || {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      accountId,
      orderId: orderId || 'order_unknown',
      type: 'redeemed',
      points: -pointsToDeduct,
      amountInr: effectiveDiscount,
      description: `Redeemed ${pointsToDeduct} Nest Points for ₹${effectiveDiscount} discount on Order #${orderId || ''}`,
      createdAt: Date.now(),
      status: 'credited',
    };

    db.loyaltyTransactions.unshift(transaction);
    saveDatabase();

    res.json({ account: updatedAccount, tx: transaction, discountInr: effectiveDiscount });
  });

  // 4. Get transactions ledger for an account
  app.get('/api/loyalty/:id/transactions', (req, res) => {
    const rawId = req.params.id;
    const accountId = sanitizeLoyaltyKey(rawId);
    if (!db.loyaltyTransactions) db.loyaltyTransactions = [];

    const orderStatusMap = new Map<string, string>();
    if (Array.isArray(db.orders)) {
      db.orders.forEach((o) => {
        if (o && o.id) orderStatusMap.set(String(o.id), String(o.status || 'pending'));
      });
    }

    const userTxs = db.loyaltyTransactions.filter((t) => {
      if (t.accountId !== accountId) return false;
      // Only include 'earned' purchase transactions if the corresponding order is delivered
      if (t.type === 'earned' && t.orderId && orderStatusMap.has(String(t.orderId))) {
        return orderStatusMap.get(String(t.orderId)) === 'delivered';
      }
      return true;
    });
    res.json(userTxs);
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

  // AI-Powered Bedsheet Description Generator Endpoint (Secure Server-Side Gemini Integration)
  app.post('/api/ai/generate-description', async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await generateProductDescription(payload);
      res.json(result);
    } catch (err: any) {
      console.error('Error generating AI description on server:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate product description.',
      });
    }
  });

  // Real Gmail SMTP-based Email OTP Verification Endpoints
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { email } = req.body || {};
      const result = await sendOtpEmail(email);
      res.status(result.status).json(result);
    } catch (err: any) {
      console.error('Server error on /api/auth/send-otp:', err);
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while sending the verification code.',
      });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { email, otp, verificationToken, token } = req.body || {};
      const tokenToVerify = typeof verificationToken === 'string' && verificationToken.trim()
        ? verificationToken.trim()
        : typeof token === 'string' && token.trim()
        ? token.trim()
        : undefined;

      const result = await verifyOtp(email, otp, tokenToVerify);
      res.status(result.status).json(result);
    } catch (err: any) {
      console.error('Server error on /api/auth/verify-otp:', err);
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while verifying the code.',
      });
    }
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
