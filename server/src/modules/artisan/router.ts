import { Router } from "express";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";
import { db } from "../../db/index.js";
import { authenticate, requirePermission, type AuthRequest } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import multer from "multer";

export const artisanRouter = Router();

// Get studio profile
artisanRouter.get("/profile", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const artisan = await db.prepare(
    `SELECT a.id, a.studio_name, a.story, a.approved, a.created_at,
            COUNT(DISTINCT p.id) as product_count
     FROM artisans a
     LEFT JOIN products p ON p.artisan_id = a.id AND p.status = 'ACTIVE'
     WHERE a.auth_account_id = ?
     GROUP BY a.id`
  ).get(user.sub);

  if (!artisan) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(artisan);
});

// Update studio profile
artisanRouter.patch("/profile", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const { studioName, story } = req.body;
  
  if (studioName) {
    await db.prepare("UPDATE artisans SET studio_name=? WHERE auth_account_id=?").run(studioName, user.sub);
  }
  if (story !== undefined) {
    await db.prepare("UPDATE artisans SET story=? WHERE auth_account_id=?").run(story, user.sub);
  }
  res.json({ message: "Profile updated" });
});

// Studio analytics
artisanRouter.get("/analytics", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const artisan = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
  if (!artisan) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const totalRevenue = await db.prepare(
      `SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) as total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE p.artisan_id = ? AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')`
    ).get(artisan.id) as unknown as { total: number };

  const topProducts = await db.prepare(
    `SELECT p.title, p.image_url, p.price_cents,
            COALESCE(SUM(oi.quantity), 0) as units_sold,
            COALESCE(i.quantity, 0) as stock
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.artisan_id = ?
     GROUP BY p.id ORDER BY units_sold DESC LIMIT 5`
  ).all(artisan.id);

  const recentOrders = await db.prepare(
    `SELECT o.id, o.status, o.total_cents, o.created_at, COUNT(oi.id) as item_count
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE p.artisan_id = ?
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 10`
  ).all(artisan.id);

  const lowStock = await db.prepare(
    `SELECT p.title, i.quantity, i.low_stock_at
     FROM inventory i JOIN products p ON p.id = i.product_id
     WHERE p.artisan_id = ? AND i.quantity <= i.low_stock_at AND p.status = 'ACTIVE'`
  ).all(artisan.id);

  const avgRating = await db.prepare(
      `SELECT COALESCE(AVG(r.rating), 0) as avg, COUNT(r.id) as count
     FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.artisan_id = ?`
    ).get(artisan.id) as unknown as { avg: number; count: number };

  res.json({ totalRevenue: totalRevenue.total, topProducts, recentOrders, lowStock, avgRating });
});

// Wishlist: toggle
artisanRouter.post("/wishlist/:productId", authenticate, requirePermission("wishlist:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
  if (!customer) { res.status(403).json({ error: "CUSTOMER_ONLY" }); return; }

  const existing = await db.prepare("SELECT id FROM wishlists WHERE customer_id=? AND product_id=?").get(customer.id, req.params.productId);
  if (existing) {
    await db.prepare("DELETE FROM wishlists WHERE customer_id=? AND product_id=?").run(customer.id, req.params.productId);
    res.json({ wishlisted: false });
  } else {
    await db.prepare("INSERT INTO wishlists(id,customer_id,product_id) VALUES(?,?,?)").run(uuid(), customer.id, req.params.productId);
    res.json({ wishlisted: true });
  }
});

// Get wishlist
artisanRouter.get("/wishlist", authenticate, requirePermission("wishlist:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
  if (!customer) { res.status(403).json({ error: "CUSTOMER_ONLY" }); return; }

  const items = await db.prepare(
    `SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, a.studio_name as artisan
     FROM wishlists w JOIN products p ON p.id = w.product_id JOIN artisans a ON a.id = p.artisan_id
     WHERE w.customer_id = ? ORDER BY w.created_at DESC`
  ).all(customer.id);

  res.json(items);
});

// Post review
artisanRouter.post("/reviews/:productId", authenticate, requirePermission("wishlist:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
  if (!customer) { res.status(403).json({ error: "CUSTOMER_ONLY" }); return; }

  const { rating, body } = req.body;
  if (!rating || rating < 1 || rating > 5 || !body) { res.status(400).json({ error: "INVALID_REVIEW" }); return; }

  try {
    await db.prepare("INSERT INTO reviews(id,customer_id,product_id,rating,body) VALUES(?,?,?,?,?)").run(
      uuid(), customer.id, req.params.productId, rating, body
    );
    res.status(201).json({ message: "Review posted" });
  } catch {
    res.status(409).json({ error: "ALREADY_REVIEWED" });
  }
});

// Get studio earnings
artisanRouter.get("/earnings", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const artisan = (await db.prepare("SELECT id, approved FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string; approved: number } | undefined;
  if (!artisan) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  if (!artisan.approved) {
    res.status(200).json({ error: "STUDIO_NOT_APPROVED" });
    return;
  }

  const lifetimeRow = await db.prepare(
      `SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) as total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE p.artisan_id = ?
       AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')`
    ).get(artisan.id) as unknown as { total: number };

  const perProduct = await db.prepare(
      `SELECT p.id as productId, p.title,
            COALESCE(SUM(oi.price_cents * oi.quantity), 0) as revenueCents,
            COALESCE(SUM(oi.quantity), 0) as unitsSold
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
     WHERE p.artisan_id = ?
     GROUP BY p.id, p.title
     ORDER BY revenueCents DESC`
    ).all(artisan.id) as unknown as Array<{ productId: string; title: string; revenueCents: number; unitsSold: number }>;

  const dailySeries = await db.prepare(
      `SELECT DATE(o.created_at) as date,
            COALESCE(SUM(oi.price_cents * oi.quantity), 0) as revenueCents,
            COUNT(DISTINCT o.id) as orders
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE p.artisan_id = ?
       AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
       AND o.created_at >= datetime('now', '-30 days')
     GROUP BY DATE(o.created_at)
     ORDER BY date ASC`
    ).all(artisan.id) as unknown as Array<{ date: string; revenueCents: number; orders: number }>;

  res.json({
    lifetimeRevenueCents: lifetimeRow.total,
    perProduct,
    dailySeries,
    approved: true,
  });
});

// Get studio payouts
artisanRouter.get("/payouts", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const artisan = (await db.prepare("SELECT id, approved FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string; approved: number } | undefined;
  if (!artisan) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  if (!artisan.approved) {
    res.status(200).json({ error: "STUDIO_NOT_APPROVED" });
    return;
  }

  const payouts = await db.prepare(
    `SELECT id, amount_cents as amountCents, status, period, created_at as createdAt
     FROM artisan_payouts
     WHERE artisan_id = ?
     ORDER BY created_at DESC`
  ).all(artisan.id);

  res.json(payouts);
});

// Get notifications
artisanRouter.get("/notifications", authenticate, async (req, res) => {
  const user = (req as AuthRequest).user;
  const notifs = await db.prepare(
    "SELECT * FROM notifications WHERE auth_account_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(user.sub);
  res.json(notifs);
});

artisanRouter.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const user = (req as AuthRequest).user;
  await db.prepare("UPDATE notifications SET read_at=datetime('now') WHERE id=? AND auth_account_id=?").run(req.params.id, user.sub);
  res.json({ message: "Marked read" });
});

// ── Product Media Upload ──────────────────────────────────────────────────────

artisanRouter.post(
  "/products/:id/media",
  authenticate,
  requirePermission("media:write"),
  async (req, res, next) => {
    // Run multer and intercept errors before the route handler
    upload.single("image")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Both file size exceeded and invalid MIME type return INVALID_MEDIA
          return res.status(400).json({ error: "INVALID_MEDIA" });
        }
        return next(err);
      }
      next();
    });
  },
  async (req, res) => {
    const user = (req as AuthRequest).user;
    const productId = req.params.id as string;

    if (user.role !== "ADMIN") {
      const artisan = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
      if (!artisan) {
        res.status(403).json({ error: "OWNERSHIP_DENIED" });
        return;
      }
      const product = (await db.prepare("SELECT artisan_id FROM products WHERE id = ?").get(productId)) as unknown as { artisan_id: string } | undefined;
      if (!product) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if (product.artisan_id !== artisan.id) {
        res.status(403).json({ error: "OWNERSHIP_DENIED" });
        return;
      }
    } else {
      const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
      if (!product) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
    }

    // Check media count limit (max 8)
    const countRow = await db.prepare("SELECT COUNT(*) as cnt FROM product_media WHERE product_id = ?").get(productId) as unknown as { cnt: number };
    if (countRow.cnt >= 8) {
      res.status(422).json({ error: "MEDIA_LIMIT_EXCEEDED" });
      return;
    }

    // Require a file to be present
    if (!req.file) {
      res.status(400).json({ error: "INVALID_MEDIA" });
      return;
    }

    // Determine extension from mime type
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = mimeToExt[req.file.mimetype] ?? "jpg";
    const fileId = uuid();
    const uploadDir = path.join("uploads", productId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${fileId}.${ext}`);
    fs.writeFileSync(filePath, req.file.buffer);

    // Determine alt text: from body or original filename
    const alt = (req.body?.alt as string | undefined) || req.file.originalname || fileId;
    // Sort order: one past current max
    const sortRow = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) as maxSort FROM product_media WHERE product_id = ?").get(productId) as unknown as { maxSort: number };
    const sortOrder = sortRow.maxSort + 1;

    // Use forward-slash URL for serving compatibility
    const url = `uploads/${productId}/${fileId}.${ext}`;

    const mediaId = uuid();
    await db.prepare(
      "INSERT INTO product_media(id, product_id, url, alt, sort_order) VALUES(?, ?, ?, ?, ?)"
    ).run(mediaId, productId, url, alt, sortOrder);

    const mediaRow = await db.prepare("SELECT * FROM product_media WHERE id = ?").get(mediaId);
    res.status(201).json(mediaRow);
  }
);

// ── Product Media Delete ──────────────────────────────────────────────────────

artisanRouter.delete(
  "/products/:id/media/:mediaId",
  authenticate,
  requirePermission("media:write"),
  async (req, res) => {
    const user = (req as AuthRequest).user;
    const productId = req.params.id;
    const mediaId = req.params.mediaId;

    // Verify artisan ownership (or ADMIN bypass)
    if (user.role !== "ADMIN") {
      const artisan = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
      if (!artisan) {
        res.status(403).json({ error: "OWNERSHIP_DENIED" });
        return;
      }
      const product = (await db.prepare("SELECT artisan_id FROM products WHERE id = ?").get(productId)) as unknown as { artisan_id: string } | undefined;
      if (!product) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if (product.artisan_id !== artisan.id) {
        res.status(403).json({ error: "OWNERSHIP_DENIED" });
        return;
      }
    }

    const media = await db.prepare("SELECT id FROM product_media WHERE id = ? AND product_id = ?").get(mediaId, productId);
    if (!media) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    await db.prepare("DELETE FROM product_media WHERE id = ?").run(mediaId);
    res.status(200).json({ message: "Deleted" });
  }
);
