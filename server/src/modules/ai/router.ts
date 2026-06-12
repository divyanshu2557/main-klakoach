import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import OpenAI from "openai";
import { db } from "../../db/index.js";
import { authenticate, requirePermission, type AuthRequest } from "../../middleware/auth.js";

export const aiRouter = Router();

// ── NVIDIA free API via OpenAI-compatible SDK ─────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "dummy-key-to-prevent-crash",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const CHAT_MODEL = "meta/llama-3.1-70b-instruct";
const DEFAULT_AI_PARAMS = {
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 1024,
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: "AI_RATE_LIMIT" } });
aiRouter.use(aiLimiter);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getLiveCatalog(limit = 30) {
  return await db.prepare(`
    SELECT p.id, p.title, p.price_cents, p.description, p.image_url,
           c.name as category, c.slug as category_slug,
           a.studio_name as artisan,
           COALESCE(i.quantity - i.reserved, 0) as stock
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN artisans a ON a.id = p.artisan_id
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.status = 'ACTIVE'
    ORDER BY p.featured DESC, p.created_at DESC
    LIMIT ?
  `).all(limit) as unknown as Array<{
      id: string; title: string; price_cents: number; description: string;
      image_url: string; category: string; category_slug: string; artisan: string; stock: number;
    }>;
}

// Simple keyword similarity (replaces embedding-based similarity)
function keywordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// ── 1. AI Shopping Assistant — streaming SSE ──────────────────────────────────

aiRouter.post("/chat", async (req, res) => {
  const { messages, sessionId } = req.body as {
    messages: { role: string; content: string }[];
    sessionId?: string;
  };
  if (!messages?.length) { res.status(400).json({ error: "MESSAGES_REQUIRED" }); return; }

  const products = await getLiveCatalog(25);
  const catalogContext = products
    .map((p) => `"${p.title}" by ${p.artisan} (${p.category}) — ₹${(p.price_cents / 100).toLocaleString("en-IN")} | ${p.description.substring(0, 100)}... (Stock: ${p.stock})`)
    .join("\n");

  const systemPrompt = `You are the elite AI Concierge for Klakoach, the world's premier luxury marketplace for handcrafted, soulful artifacts. You represent a high-end, multi-billion dollar luxury brand. Your tone must be impeccably refined, deeply knowledgeable, highly professional, and flawlessly polite—a true white-glove concierge experience.

LIVE CATALOG:
${catalogContext}

Core Directives:
1. Speak with extreme sophistication and elegance. Use elevated vocabulary but remain accessible. Never sound like a generic chatbot; you are a high-end art curator and personal shopper.
2. Only recommend pieces that are strictly available in the LIVE CATALOG provided above.
3. When recommending a product, articulate its unique artisan value, its aesthetic impact, and seamlessly weave the exact price and title into your prose.
4. If a requested style is unavailable, gracefully pivot to an available catalog item that shares a similar artistic spirit.
5. Provide answers that are concise yet richly descriptive. Use elegant markdown formatting (like italicizing titles or using subtle bullet points) when presenting multiple options.
6. If the user expresses a desire to purchase or explicitly agrees to add a recommended piece to their cart, immediately invoke the \`add_to_cart\` tool with the precise product title. Handle this elegantly without breaking character.`;

  if (sessionId && messages.length > 0) {
    const last = messages[messages.length - 1];
    await db.prepare("INSERT INTO ai_chat_sessions(id,session_id,role,content) VALUES(?,?,?,?)")
      .run(crypto.randomUUID(), sessionId, last.role, last.content);
  }

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "add_to_cart",
            description: "Add a product to the user's shopping cart.",
            parameters: {
              type: "object",
              properties: {
                product_title: { type: "string", description: "The exact title of the product to add." }
              },
              required: ["product_title"]
            }
          }
        }
      ],
      stream: true,
    });

    let fullResponse = "";
    let toolCallName = "";
    let toolCallArgs = "";

    for await (const chunk of stream) {
      const deltaObj = chunk.choices[0]?.delta;
      if (!deltaObj) continue;

      if (deltaObj.tool_calls?.length) {
        const tc = deltaObj.tool_calls[0];
        if (tc.function?.name) toolCallName += tc.function.name;
        if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
      }

      const contentDelta = deltaObj.content ?? "";
      const reasoningDelta = (deltaObj as any).reasoning_content ?? "";
      const delta = reasoningDelta + contentDelta;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    if (toolCallName === "add_to_cart" && toolCallArgs) {
      try {
        const args = JSON.parse(toolCallArgs);
        const product = products.find(p => p.title.toLowerCase().includes(args.product_title.toLowerCase()) || args.product_title.toLowerCase().includes(p.title.toLowerCase()));
        if (product) {
          res.write(`data: ${JSON.stringify({ action: "ADD_TO_CART", product })}\n\n`);
        }
      } catch (e) {
        console.error("Tool call parsing failed:", e);
      }
    }

    if (sessionId) {
      await db.prepare("INSERT INTO ai_chat_sessions(id,session_id,role,content) VALUES(?,?,?,?)")
        .run(crypto.randomUUID(), sessionId, "assistant", fullResponse);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI_UNAVAILABLE" })}\n\n`);
    res.end();
  }
});

// ── 2. AI Recommendations — keyword similarity ────────────────────────────────

aiRouter.get("/recommendations", async (req, res) => {
  const { productId, context = "marketplace" } = req.query as { productId?: string; context?: string };
  const products = await getLiveCatalog(48);

  try {
    if (productId) {
      const anchor = products.find((p) => p.id === productId);
      if (!anchor) { res.json({ products: products.slice(0, 4) }); return; }

      const anchorText = `${anchor.title} ${anchor.description} ${anchor.category} ${anchor.artisan}`;

      const scored = products
        .filter((p) => p.id !== productId)
        .map((p) => ({
          product: p,
          score: keywordSimilarity(anchorText, `${p.title} ${p.description} ${p.category} ${p.artisan}`),
        }))
        .sort((a, b) => b.score - a.score);

      res.json({ products: scored.slice(0, 4).map((s) => s.product) });
      return;
    }

    const limit: Record<string, number> = { homepage: 4, cart: 3, checkout: 2, marketplace: 4 };
    res.json({ products: products.filter((p) => p.stock > 0).slice(0, limit[context] ?? 4) });
  } catch {
    res.json({ products: products.slice(0, 4) });
  }
});

// ── 3. Visual Search — text-based analysis (no vision on free tier) ───────────

aiRouter.post("/visual-search", upload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "IMAGE_REQUIRED" }); return; }

  // Use filename and MIME type to infer what the user uploaded
  const filename = req.file.originalname?.toLowerCase() ?? "";

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `A user uploaded an image named "${filename}" to search for similar handmade products on a luxury marketplace.
Based on the filename, suggest what kind of decorative or home object this might be.
Return JSON: { "object": string, "material": string, "style": string, "colors": ["neutral"], "searchKeywords": string[] }
searchKeywords: 3-5 terms useful for finding similar handmade products.`
      }],
      
    });

    let detected: { object: string; material: string; style: string; colors: string[]; searchKeywords: string[] };
    try {
      detected = JSON.parse(result.choices[0].message.content!) as typeof detected;
    } catch {
      detected = { object: "handmade object", material: "mixed", style: "artisan", colors: ["neutral"], searchKeywords: ["handmade", "artisan", "decor"] };
    }

    const products = await db.prepare(`
      SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.description,
             c.name as category, c.slug as category_slug, a.studio_name as artisan,
             COALESCE(i.quantity - i.reserved, 0) as stock,
             COALESCE(AVG(r.rating), 0) as avg_rating,
             COUNT(DISTINCT r.id) as review_count, p.created_at
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN artisans a ON a.id = p.artisan_id
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN reviews r ON r.product_id = p.id
      WHERE p.status = 'ACTIVE' AND (p.title LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
      GROUP BY p.id
      ORDER BY p.featured DESC LIMIT 8
    `).all(`%${detected.object}%`, `%${detected.material}%`, `%${detected.object}%`);

    res.json({ detected, products });
  } catch {
    res.status(500).json({ error: "VISION_FAILED" });
  }
});

// ── 4. Gift Finder ────────────────────────────────────────────────────────────

aiRouter.post("/gift-finder", async (req, res) => {
  const { occasion, recipient, budgetMin = 500, budgetMax = 10000, interests = "" } = req.body as {
    occasion: string; recipient: string; budgetMin: number; budgetMax: number; interests?: string;
  };

  const products = await db.prepare(`
    SELECT p.id, p.title, p.price_cents, p.description, p.image_url,
           c.name as category, a.studio_name as artisan,
           COALESCE(i.quantity - i.reserved, 0) as stock
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN artisans a ON a.id = p.artisan_id
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.status = 'ACTIVE' AND p.price_cents BETWEEN ? AND ?
      AND (i.quantity - COALESCE(i.reserved,0)) > 0
    ORDER BY p.featured DESC LIMIT 30
  `).all(budgetMin * 100, budgetMax * 100) as unknown as Array<{
      id: string; title: string; price_cents: number; description: string;
      image_url: string; category: string; artisan: string; stock: number;
    }>;

  if (!products.length) { res.json({ gifts: [] }); return; }

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Gift curation expert for a luxury handmade marketplace.
Pick best 4 products for: ${occasion} gift for ${recipient}. Budget: ₹${budgetMin}–₹${budgetMax}. Interests: ${interests || "general"}.
Products: ${JSON.stringify(products.map((p) => ({ id: p.id, title: p.title, price: p.price_cents / 100, category: p.category, desc: p.description?.slice(0, 60) })))}
Return JSON: { "picks": [{ "id": string, "reason": string (max 12 words) }] }`
      }],
      
    });

    let picks: { id: string; reason: string }[] = [];
    try {
      const parsed = JSON.parse(result.choices[0].message.content!) as { picks: typeof picks };
      picks = parsed.picks;
    } catch {
      picks = products.slice(0, 4).map(p => ({ id: p.id, reason: "Perfect handmade choice" }));
    }
    const gifts = picks
      .map((pick) => ({ ...products.find((p) => p.id === pick.id), aiReason: pick.reason }))
      .filter((g) => g.id);

    res.json({ gifts });
  } catch {
    res.json({ gifts: products.slice(0, 4).map((p) => ({ ...p, aiReason: "Perfect handmade choice" })) });
  }
});

// ── 5. AI Listing Generator ───────────────────────────────────────────────────

aiRouter.post("/generate-listing", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const { imageUrl, category, material } = req.body as { imageUrl: string; category: string; material?: string };
  if (!imageUrl) { res.status(400).json({ error: "IMAGE_URL_REQUIRED" }); return; }

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Luxury handmade marketplace copywriter for Klakoach.
Category: ${category}. Material: ${material || "handcrafted"}.
Generate a compelling product listing.
Return JSON: {
  "title": "compelling 4-7 word product name",
  "description": "story-driven 60-80 words, mention craft technique and emotional value",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "seoKeywords": ["kw1","kw2","kw3"],
  "suggestedPricePaise": number
}`
      }],
      
    });

    try {
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch {
      res.json({ title: "Handcrafted Artisan Piece", description: "A beautiful handmade creation.", tags: [category], seoKeywords: [category], suggestedPricePaise: 250000 });
    }
  } catch {
    res.status(500).json({ error: "GENERATION_FAILED" });
  }
});

// ── 6. AI Translation ─────────────────────────────────────────────────────────

aiRouter.post("/translate", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const { productId, targetLanguage } = req.body as { productId: string; targetLanguage: string };
  const product = await db.prepare("SELECT title, description, translations FROM products WHERE id = ?")
      .get(productId) as unknown as { title: string; description: string; translations: string } | undefined;
  if (!product) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const supported = ["Hindi", "Punjabi", "Tamil", "Bengali", "French", "German", "Spanish"];
  if (!supported.includes(targetLanguage)) { res.status(400).json({ error: "UNSUPPORTED_LANGUAGE" }); return; }

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Translate this handmade product listing to ${targetLanguage}. Keep brand names and material names in English or transliterated. Preserve luxury tone.
Return JSON: { "title": "...", "description": "..." }
Original: ${JSON.stringify({ title: product.title, description: product.description })}`
      }],
      
    });

    let translated: { title: string; description: string };
    try {
      translated = JSON.parse(result.choices[0].message.content!) as typeof translated;
    } catch {
      translated = { title: product.title, description: product.description };
    }
    const existing = product.translations ? JSON.parse(product.translations) : {};
    existing[targetLanguage] = translated;
    await db.prepare("UPDATE products SET translations=? WHERE id=?").run(JSON.stringify(existing), productId);

    res.json(translated);
  } catch {
    res.status(500).json({ error: "TRANSLATION_FAILED" });
  }
});

// ── 7. AI Pricing Assistant ───────────────────────────────────────────────────

aiRouter.post("/pricing-assist", authenticate, requirePermission("inventory:write"), async (req, res) => {
  const { title, category, description, material } = req.body as {
    title: string; category: string; description: string; material?: string;
  };

  const comps = await db.prepare(`
    SELECT p.price_cents, COALESCE(SUM(oi.quantity), 0) as units_sold
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    JOIN categories c ON c.id = p.category_id
    WHERE c.slug = ? AND p.status = 'ACTIVE'
    GROUP BY p.id ORDER BY units_sold DESC LIMIT 10
  `).all(category) as unknown as { price_cents: number; units_sold: number }[];

  const avgPrice = comps.length ? Math.round(comps.reduce((s, p) => s + p.price_cents, 0) / comps.length) : 0;
  const topPrice = comps[0]?.price_cents ?? 0;
  const minPrice = comps.length ? Math.min(...comps.map((p) => p.price_cents)) : 0;

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Handmade marketplace pricing expert for India (prices in paise).
Product: "${title}". Category: ${category}. Material: ${material || "unknown"}. Desc: "${description?.slice(0, 100)}".
Market: avg=${avgPrice}, top=${topPrice}, min=${minPrice}, n=${comps.length}.
Return JSON: { "suggestedMinPaise": number, "suggestedMaxPaise": number, "reasoning": "1 sentence", "marginNote": "1 sentence" }`
      }],
      
    });

    try {
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch {
      res.json({ suggestedMinPaise: Math.round(avgPrice * 0.8), suggestedMaxPaise: Math.round(avgPrice * 1.3), reasoning: "Based on category averages.", marginNote: "Standard margin." });
    }
  } catch {
    res.json({
      suggestedMinPaise: Math.round(avgPrice * 0.8),
      suggestedMaxPaise: Math.round(avgPrice * 1.3),
      reasoning: "Based on category market averages.",
      marginNote: "Standard margin range for this category."
    });
  }
});

// ── 8. Enhanced Fraud Analysis ────────────────────────────────────────────────

aiRouter.post("/fraud-analyze", authenticate, requirePermission("analytics:read"), async (req, res) => {
  const { orderId } = req.body as { orderId: string };
  const order = await db.prepare(`
    SELECT o.id, o.total_cents, o.fraud_score, o.status, o.created_at,
           cu.name as customer_name, COUNT(oi.id) as item_count
    FROM orders o
    JOIN customers cu ON cu.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = ? GROUP BY o.id
  `).get(orderId) as unknown as { id: string; total_cents: number; fraud_score: number; status: string; created_at: string; customer_name: string; item_count: number } | undefined;

  if (!order) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const history = await db.prepare(
      "SELECT COUNT(*) as c FROM orders o JOIN customers cu ON cu.id = o.customer_id WHERE cu.name = ?"
    ).get(order.customer_name) as unknown as { c: number };

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `E-commerce fraud analysis. Score 0.0-1.0 (1.0=certain fraud).
Order: totalINR=${order.total_cents / 100}, items=${order.item_count}, prevOrders=${history.c}, existingScore=${order.fraud_score}, status=${order.status}.
Return JSON: { "score": number, "reason": "brief", "recommendation": "approve|review|block" }`
      }],
      
    });

    let analysis: { score: number; reason: string; recommendation: string };
    try {
      analysis = JSON.parse(result.choices[0].message.content!) as typeof analysis;
    } catch {
      analysis = { score: order.fraud_score, reason: "Heuristic score", recommendation: "review" };
    }
    const finalScore = Math.min(1, Math.max(0, analysis.score));
    await db.prepare("UPDATE orders SET fraud_score=?, fraud_reason=? WHERE id=?")
      .run(finalScore, analysis.reason, orderId);

    res.json({ ...analysis, score: finalScore });
  } catch {
    res.json({ score: order.fraud_score, reason: "Heuristic score", recommendation: "review" });
  }
});

// ── 9. AI Quality Check ───────────────────────────────────────────────────────

aiRouter.post("/quality-check", authenticate, requirePermission("analytics:read"), async (req, res) => {
  const { productId, imageUrl, title, description } = req.body as {
    productId: string; imageUrl: string; title: string; description: string;
  };

  const duplicates = await db.prepare(
      "SELECT COUNT(*) as c FROM products WHERE title LIKE ? AND id != ? AND status != 'ARCHIVED'"
    ).get(`%${title.substring(0, 20)}%`, productId) as unknown as { c: number };

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Quality check for a handmade marketplace listing (text analysis only).
Title: "${title}". Description: "${description?.slice(0, 100)}". Similar titles in DB: ${duplicates.c}. Image URL provided: ${imageUrl ? "yes" : "no"}.
Return JSON: {
  "imageQuality": "good|poor|stock_photo|ai_generated",
  "authenticityScore": 0-100,
  "duplicateRisk": "low|medium|high",
  "recommendation": "approve|review|reject",
  "notes": "one brief sentence"
}`
      }],
      
    });

    try {
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch {
      res.json({ imageQuality: "good", authenticityScore: 75, duplicateRisk: duplicates.c > 2 ? "high" : "low", recommendation: "review", notes: "Manual check recommended." });
    }
  } catch {
    res.json({
      imageQuality: "good",
      authenticityScore: 75,
      duplicateRisk: duplicates.c > 2 ? "high" : "low",
      recommendation: "review",
      notes: "Manual check recommended."
    });
  }
});

// ── 10. Admin AI Insights ─────────────────────────────────────────────────────

aiRouter.get("/admin-insights", authenticate, requirePermission("analytics:read"), async (req, res) => {
  const gmv = (await db.prepare("SELECT COALESCE(SUM(total_cents),0) as t FROM orders WHERE status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')").get() as unknown as { t: number }).t;
  const orderCount = (await db.prepare("SELECT COUNT(*) as c FROM orders").get() as unknown as { c: number }).c;
  const activeProducts = (await db.prepare("SELECT COUNT(*) as c FROM products WHERE status='ACTIVE'").get() as unknown as { c: number }).c;
  const pendingProducts = (await db.prepare("SELECT COUNT(*) as c FROM products WHERE status='PENDING_REVIEW'").get() as unknown as { c: number }).c;
  const pendingArtisans = (await db.prepare("SELECT COUNT(*) as c FROM artisans WHERE approved=0").get() as unknown as { c: number }).c;
  const fraudAlerts = (await db.prepare("SELECT COUNT(*) as c FROM orders WHERE fraud_score > 0.3").get() as unknown as { c: number }).c;
  const lowStock = (await db.prepare("SELECT COUNT(*) as c FROM inventory WHERE quantity <= low_stock_at AND quantity > 0").get() as unknown as { c: number }).c;

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Business analyst for Klakoach handmade marketplace.
Data: GMV=₹${gmv / 100}, orders=${orderCount}, activeProducts=${activeProducts}, pendingReview=${pendingProducts}, pendingArtisans=${pendingArtisans}, fraudAlerts=${fraudAlerts}, lowStockItems=${lowStock}.
Generate exactly 3 actionable business insights.
Return JSON: { "insights": [{ "title": string, "detail": string, "action": string (max 8 words), "urgency": "high|medium|low" }] }`
      }],
      
    });

    try {
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch {
      res.json({ insights: [
        { title: "Review pending items", detail: `${pendingProducts} products and ${pendingArtisans} artisans awaiting approval.`, action: "Process approvals now", urgency: "high" },
        { title: "Monitor fraud queue", detail: `${fraudAlerts} orders flagged with fraud score > 0.3.`, action: "Review flagged orders", urgency: fraudAlerts > 5 ? "high" : "medium" },
        { title: "Restock alerts", detail: `${lowStock} products at or below low-stock threshold.`, action: "Notify artisans to restock", urgency: "medium" },
      ]});
    }
  } catch {
    res.json({
      insights: [
        { title: "Review pending items", detail: `${pendingProducts} products and ${pendingArtisans} artisans awaiting approval.`, action: "Process approvals now", urgency: "high" },
        { title: "Monitor fraud queue", detail: `${fraudAlerts} orders flagged with fraud score > 0.3.`, action: "Review flagged orders", urgency: fraudAlerts > 5 ? "high" : "medium" },
        { title: "Restock alerts", detail: `${lowStock} products at or below low-stock threshold.`, action: "Notify artisans to restock", urgency: "medium" },
      ]
    });
  }
});

// ── 11. Artisan Story AI ──────────────────────────────────────────────────────

aiRouter.post("/artisan-story", authenticate, requirePermission("artisan:profile"), async (req, res) => {
  const user = (req as AuthRequest).user;
  const { studioName, craft, story, location, yearsActive } = req.body as {
    studioName: string; craft: string; story?: string; location?: string; yearsActive?: number;
  };

  try {
    const result = await openai.chat.completions.create({
      model: CHAT_MODEL,
      ...DEFAULT_AI_PARAMS,
      messages: [{
        role: "user",
        content: `Write a compelling artisan story for a luxury handmade marketplace.
Studio: "${studioName}". Craft: ${craft}. Location: ${location || "India"}. Years active: ${yearsActive || "several"}.
Artisan says: "${story || "I make handcrafted pieces with love and attention to detail."}".
Write 3 paragraphs (~120 words total): origin story, craft philosophy, connection with customer.
First person. Warm, literary, authentic. Do not invent facts not provided.`
      }],
      
    });

    const generatedStory = result.choices[0].message.content!;
    await db.prepare("UPDATE artisans SET ai_story=? WHERE auth_account_id=?").run(generatedStory, user.sub);

    res.json({ story: generatedStory });
  } catch {
    res.status(500).json({ error: "STORY_GENERATION_FAILED" });
  }
});
