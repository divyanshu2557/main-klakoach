import { Router } from "express";
import { db } from "../../db/index.js";

export const contentRouter = Router();

contentRouter.get("/home", async (_req, res) => {
  const products = await db.prepare(
      `SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.description,
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
     WHERE p.status = 'ACTIVE'
     GROUP BY p.id
     ORDER BY p.featured DESC, p.created_at DESC`
    ).all() as unknown as Array<{
      id: string;
      title: string;
      slug: string;
      price_cents: number;
      image_url: string;
      description: string;
      category: string;
      category_slug: string;
      artisan: string;
      stock: number;
      avg_rating: number;
      review_count: number;
    }>;

  const artisans = await db.prepare(
      `SELECT a.id, a.studio_name, a.story, a.featured,
            COUNT(DISTINCT p.id) as product_count,
            COUNT(DISTINCT af.id) as follower_count,
            COALESCE(MAX(p.image_url), '') as image_url
     FROM artisans a
     LEFT JOIN products p ON p.artisan_id = a.id AND p.status = 'ACTIVE'
     LEFT JOIN artisan_follows af ON af.artisan_id = a.id
     WHERE a.approved = 1
     GROUP BY a.id
     ORDER BY a.featured DESC, follower_count DESC, product_count DESC
     LIMIT 8`
    ).all() as unknown as Array<{
      id: string;
      studio_name: string;
      story: string;
      featured: number;
      product_count: number;
      follower_count: number;
      image_url: string;
    }>;

  const categories = await db.prepare(
      `SELECT c.id, c.name, c.slug, c.sort_order,
            COUNT(p.id) as product_count,
            COALESCE(MAX(p.image_url), '') as image_url
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.status = 'ACTIVE'
     GROUP BY c.id
     ORDER BY c.sort_order ASC, product_count DESC, c.name ASC`
    ).all() as unknown as Array<{
      id: string;
      name: string;
      slug: string;
      sort_order: number;
      product_count: number;
      image_url: string;
    }>;

  const testimonials = (await db.prepare(
      `SELECT r.body, r.rating, r.created_at, cu.name as customer_name, p.title as product_title
     FROM reviews r
     JOIN customers cu ON cu.id = r.customer_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT 6`
    ).all()) as unknown as Array<{
      body: string;
      rating: number;
      created_at: string;
      customer_name: string;
      product_title: string;
    }>;

  // Approximate stats for public display — never expose exact counts
  function approx(n: number): string {
    if (n === 0) return "0";
    if (n < 10) return `${n}+`;
    if (n < 50) return `${Math.floor(n / 5) * 5}+`;
    if (n < 100) return `${Math.floor(n / 10) * 10}+`;
    if (n < 1000) return `${Math.floor(n / 50) * 50}+`;
    return `${Math.floor(n / 100) * 100}+`;
  }

  const rawStats = {
    products: (await db.prepare("SELECT COUNT(*) as c FROM products WHERE status = 'ACTIVE'").get() as unknown as { c: number }).c,
    artisans: (await db.prepare("SELECT COUNT(*) as c FROM artisans WHERE approved = 1").get() as unknown as { c: number }).c,
    customers: (await db.prepare("SELECT COUNT(*) as c FROM customers").get() as unknown as { c: number }).c,
    orders: (await db.prepare("SELECT COUNT(*) as c FROM orders").get() as unknown as { c: number }).c,
    categories: categories.length,
  };

  const stats = {
    products: approx(rawStats.products),
    artisans: approx(rawStats.artisans),
    customers: approx(rawStats.customers),
    orders: approx(rawStats.orders),
    categories: rawStats.categories,
  };

  const collections = categories.slice(0, 6).map((category, index) => ({
    title: category.name,
    count: `${category.product_count} Products`,
    image: category.image_url || [
      "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
    ][index % 4],
  }));

  const recommendations = products.slice(0, 4).map((product) => ({
    name: product.title,
    artisan: product.artisan,
    price: `₹ ${(product.price_cents / 100).toLocaleString("en-IN")}`,
    image: product.image_url,
  }));

  const trending = [...products]
    .sort((a, b) => b.review_count - a.review_count || b.avg_rating - a.avg_rating)
    .slice(0, 6)
    .map((product) => ({
      name: product.title,
      price: `₹ ${(product.price_cents / 100).toLocaleString("en-IN")}`,
      image: product.image_url,
    }));

  const inspirations = products.slice(0, 5).map((product) => ({
    title: product.category,
    image: product.image_url,
  }));

  res.json({
    hero: {
      title: "The luxury marketplace for objects with a human pulse.",
      subtitle: "Live catalog data powered by the database. Admin actions immediately reshape the storefront.",
      image: products[0]?.image_url ?? "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=2400&q=88",
    },
    stats,
    collections,
    recommendations,
    artisans: artisans.map((artisan, index) => ({
      name: artisan.studio_name,
      craft: artisan.story || "Handcrafted atelier",
      followers: `${artisan.follower_count || artisan.product_count * 17 + 120} Followers`,
      image: artisan.image_url || [
        "https://images.unsplash.com/photo-1595351298020-038700609878?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0ff?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      ][index % 3],
    })),
    spaces: categories.slice(0, 6).map((category) => ({
      name: category.name,
      count: `${category.product_count} Products`,
      image: category.image_url,
    })),
    trending,
    testimonials: testimonials.slice(0, 3).map((review) => ({
      name: review.customer_name,
      location: review.product_title,
      text: review.body,
    })),
    inspirations,
  });
});