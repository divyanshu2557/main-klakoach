import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import { authenticate, requirePermission, type AuthRequest } from "../../middleware/auth.js";

export const productsRouter = Router();

const ProductSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  priceCents: z.number().int().positive(),
  categoryId: z.string(),
  imageUrl: z.string().url().optional().default(""),
  stock: z.number().int().min(0).default(0),
});

async function slugify(title: string, id: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id.slice(0, 8);
}

function toProductResponse(row: Record<string, unknown>) {
  return row;
}

// Public: list products with pagination + filters
productsRouter.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(48, parseInt(req.query.limit as string) || 12);
  const offset = (page - 1) * limit;
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const minPrice = parseInt(req.query.minPrice as string) || 0;
  const maxPrice = parseInt(req.query.maxPrice as string) || 99999999;
  const minRating = parseFloat(req.query.minRating as string) || 0;
  const inStock = req.query.inStock === "true";
  const sort = req.query.sort as string || "created_at_desc";

  let where = "WHERE p.status = 'ACTIVE' AND p.price_cents BETWEEN ? AND ?";
  const params: unknown[] = [minPrice, maxPrice];

  if (category) { where += " AND c.slug = ?"; params.push(category); }
  if (search) { where += " AND (p.title LIKE ? OR p.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  if (inStock) { where += " AND COALESCE(i.quantity - i.reserved, 0) > 0"; }

  // minRating is applied as a HAVING clause after GROUP BY
  let having = "";
  if (minRating > 0) {
    having = " HAVING COALESCE(AVG(r.rating), 0) >= ?";
  }

  const orderMap: Record<string, string> = {
    created_at_desc: "p.created_at DESC",
    price_asc: "p.price_cents ASC",
    price_desc: "p.price_cents DESC",
    title_asc: "p.title ASC",
    rating_desc: "avg_rating DESC",
  };
  // Improved search ranking: title match first, then avg_rating, then stock
  let orderBy = orderMap[sort] ?? "p.created_at DESC";
  if (search) {
    orderBy = `(p.title LIKE '%${search.replace(/'/g, "''")}%') DESC, avg_rating DESC, stock DESC`;
  }

  const countParams = [...params];
  if (minRating > 0) countParams.push(minRating);

  const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM (
       SELECT p.id FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN reviews r ON r.product_id = p.id
       ${where}
       GROUP BY p.id
       ${having}
     )`
    ).get(...countParams) as unknown as { total: number };

  const queryParams = [...params];
  if (minRating > 0) queryParams.push(minRating);

  const products = await db.prepare(
    `SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.created_at,
            c.name as category, c.slug as category_slug,
            a.studio_name as artisan,
            COALESCE(i.quantity - i.reserved, 0) as stock,
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(DISTINCT r.id) as review_count
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN artisans a ON a.id = p.artisan_id
     LEFT JOIN inventory i ON i.product_id = p.id
     LEFT JOIN reviews r ON r.product_id = p.id
     ${where}
     GROUP BY p.id, p.title, p.slug, p.price_cents, p.image_url, p.created_at, c.name, c.slug, a.studio_name, i.quantity, i.reserved
     ${having}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`
  ).all(...queryParams, limit, offset);

  res.json({ products, total: countRow.total, page, limit, pages: Math.ceil(countRow.total / limit) });
});

// Artisan: create product
productsRouter.post("/", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }); return; }

  const artisan = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ? AND approved = 1").get(user.sub)) as unknown as { id: string } | undefined;
  if (!artisan) { res.status(403).json({ error: "ARTISAN_NOT_APPROVED" }); return; }

  const id = uuid();
  const slug = slugify(parsed.data.title, id);

  
    await db.prepare(
      `INSERT INTO products(id,artisan_id,category_id,title,slug,description,price_cents,image_url,status)
       VALUES(?,?,?,?,?,?,?,?,'PENDING_REVIEW')`
    ).run(id, artisan.id, parsed.data.categoryId, parsed.data.title, slug, parsed.data.description, parsed.data.priceCents, parsed.data.imageUrl);
    await db.prepare(
      "INSERT INTO inventory(id,product_id,quantity) VALUES(?,?,?)"
    ).run(uuid(), id, parsed.data.stock);
  

  res.status(201).json({ id, slug });
});

// Artisan: update product
productsRouter.patch("/:id", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const product = (await db.prepare(
      "SELECT p.id, a.auth_account_id FROM products p JOIN artisans a ON a.id = p.artisan_id WHERE p.id = ?"
    ).get(req.params.id)) as unknown as { id: string; auth_account_id: string } | undefined;

  if (!product) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  if (product.auth_account_id !== user.sub && user.role !== "ADMIN") {
    res.status(403).json({ error: "OWNERSHIP_DENIED" }); return;
  }

  const { title, description, priceCents, imageUrl, stock, status } = req.body;
  if (title) await db.prepare("UPDATE products SET title=?,updated_at=datetime('now') WHERE id=?").run(title, req.params.id);
  if (description !== undefined) await db.prepare("UPDATE products SET description=? WHERE id=?").run(description, req.params.id);
  if (priceCents) await db.prepare("UPDATE products SET price_cents=? WHERE id=?").run(priceCents, req.params.id);
  if (imageUrl !== undefined) await db.prepare("UPDATE products SET image_url=? WHERE id=?").run(imageUrl, req.params.id);
  if (stock !== undefined) await db.prepare("UPDATE inventory SET quantity=?,updated_at=datetime('now') WHERE product_id=?").run(stock, req.params.id);
  if (status && user.role === "ADMIN") await db.prepare("UPDATE products SET status=? WHERE id=?").run(status, req.params.id);

  res.json({ message: "Updated" });
});

// Artisan: get own products
productsRouter.get("/artisan/mine", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const user = (req as AuthRequest).user;
  
  const artisan = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(user.sub)) as unknown as { id: string } | undefined;
  if (!artisan) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const products = await db.prepare(
    `SELECT p.*, COALESCE(i.quantity,0) as stock, COALESCE(i.reserved,0) as reserved,
            COALESCE(AVG(r.rating),0) as avg_rating, COUNT(DISTINCT r.id) as review_count
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE p.artisan_id = ?
     GROUP BY p.id, p.artisan_id, p.category_id, p.title, p.slug, p.description, p.price_cents, p.status, p.image_url, p.featured, p.tags, p.seo_keywords, p.translations, p.created_at, p.updated_at, i.quantity, i.reserved ORDER BY p.created_at DESC`
  ).all(artisan.id);
  res.json(products);
});

// Public: categories
productsRouter.get("/meta/categories", async (_req, res) => {
  res.json(await db.prepare("SELECT * FROM categories ORDER BY name").all());
});

// Public: single product
productsRouter.get("/:slug", async (req, res) => {
  const product = await db.prepare(
    `SELECT p.*, c.name as category, c.slug as category_slug,
            a.studio_name as artisan, a.id as artisan_id,
            COALESCE(i.quantity - i.reserved, 0) as stock,
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(DISTINCT r.id) as review_count
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN artisans a ON a.id = p.artisan_id
     LEFT JOIN inventory i ON i.product_id = p.id
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE p.slug = ? AND p.status = 'ACTIVE'
     GROUP BY p.id, p.artisan_id, p.category_id, p.title, p.slug, p.description, p.price_cents, p.status, p.image_url, p.featured, p.tags, p.seo_keywords, p.translations, p.created_at, p.updated_at, c.name, c.slug, a.studio_name, a.id, i.quantity, i.reserved`
  ).get(req.params.slug);

  if (!product) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const reviews = await db.prepare(
    `SELECT r.rating, r.body, r.created_at, cu.name as customer_name
     FROM reviews r JOIN customers cu ON cu.id = r.customer_id
     WHERE r.product_id = (SELECT id FROM products WHERE slug = ?)
     ORDER BY r.created_at DESC LIMIT 20`
  ).all(req.params.slug);

  res.json({ ...product as object, reviews });
});
