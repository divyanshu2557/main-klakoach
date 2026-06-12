import { v4 as uuid } from "uuid";
import { hashPassword } from "../security/tokens.js";
const demoArtisans = [
    {
        email: "meera@klakoach.local",
        password: "Artisan@1234",
        studioName: "Meera Vaidya Studio",
        story: "Ceramic vessels shaped slowly, glazed by hand, and finished for contemporary spaces.",
        featured: 1,
        products: [
            {
                id: "prod_raku_vase",
                title: "Raku Shadow Vase",
                slug: "raku-shadow-vase",
                description: "Small-batch ceramic vase with a matte raku finish.",
                price_cents: 189000,
                image_url: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "ceramics",
                status: "ACTIVE",
                featured: 1,
                inventory: 14,
            },
            {
                id: "prod_earth_bowl",
                title: "Earthline Serving Bowl",
                slug: "earthline-serving-bowl",
                description: "A deep serving bowl with a tactile mineral glaze.",
                price_cents: 245000,
                image_url: "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "ceramics",
                status: "ACTIVE",
                inventory: 9,
            },
        ],
    },
    {
        email: "ananya@klakoach.local",
        password: "Artisan@1234",
        studioName: "Ananya Loom House",
        story: "Textiles woven in warm, layered palettes for modern interiors and hospitality spaces.",
        featured: 1,
        products: [
            {
                id: "prod_linen_throw",
                title: "Atelier Linen Throw",
                slug: "atelier-linen-throw",
                description: "Heavyweight loom-woven throw with a soft drape and natural dye palette.",
                price_cents: 680000,
                image_url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "textiles",
                status: "ACTIVE",
                featured: 1,
                inventory: 11,
            },
            {
                id: "prod_macrame_panel",
                title: "Macrame Arc Panel",
                slug: "macrame-arc-panel",
                description: "Sculptural wall textile with layered knot work and soft fringe.",
                price_cents: 229000,
                image_url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "textiles",
                status: "ACTIVE",
                inventory: 6,
            },
        ],
    },
    {
        email: "rohan@klakoach.local",
        password: "Artisan@1234",
        studioName: "Rohan Wood Atelier",
        story: "Wood, turned and carved into luminous functional forms with a contemporary edge.",
        products: [
            {
                id: "prod_tripod_lamp",
                title: "Wooden Tripod Lamp",
                slug: "wooden-tripod-lamp",
                description: "Minimal tripod lamp in walnut finish with linen shade.",
                price_cents: 349000,
                image_url: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "lighting",
                status: "ACTIVE",
                featured: 1,
                inventory: 7,
            },
            {
                id: "prod_carved_bowl",
                title: "Carved Serving Bowl",
                slug: "carved-serving-bowl",
                description: "Hand-carved acacia bowl for tables, consoles, and gifting.",
                price_cents: 215000,
                image_url: "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=1200&q=85",
                categorySlug: "woodwork",
                status: "ACTIVE",
                inventory: 10,
            },
        ],
    },
];
const demoCustomer = {
    email: "collector@klakoach.local",
    password: "Customer@1234",
    name: "Aarav Mehta",
};
async function ensureAccount(db, email, password, kind) {
    const existing = (await db.prepare("SELECT id FROM auth_accounts WHERE email = ?").get(email));
    if (existing)
        return existing.id;
    const id = uuid();
    const passwordHash = await hashPassword(password);
    await db.prepare("INSERT INTO auth_accounts(id,email,password_hash,kind) VALUES(?,?,?,?)").run(id, email, passwordHash, kind);
    return id;
}
async function ensureInitialAdmin(db) {
    const adminCount = (await db.prepare("SELECT COUNT(*) as c FROM auth_accounts WHERE kind = 'ADMIN'").get())?.c ?? 0;
    if (Number(adminCount) > 0)
        return;
    const email = process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!email || !password) {
        if (process.env.NODE_ENV === "production") {
            console.warn("No ADMIN account exists. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD once to bootstrap the first admin.");
        }
        return;
    }
    const id = uuid();
    const passwordHash = await hashPassword(password);
    await db.prepare("INSERT INTO auth_accounts(id,email,password_hash,kind) VALUES(?,?,?,?)").run(id, email, passwordHash, "ADMIN");
    await db.prepare("INSERT INTO admin_accounts(id,auth_account_id,display_name,clearance) VALUES(?,?,?,?)")
        .run(uuid(), id, process.env.INITIAL_ADMIN_NAME ?? "Platform Admin", "owner");
}
export async function seedDemoData(db) {
    await ensureInitialAdmin(db);
    const allowDemoSeed = process.env.SEED_DEMO_DATA === "true" || process.env.NODE_ENV !== "production";
    if (!allowDemoSeed) {
        return;
    }
    const authCount = (await db.prepare("SELECT COUNT(*) as c FROM auth_accounts").get())?.c ?? 0;
    const productCount = (await db.prepare("SELECT COUNT(*) as c FROM products").get())?.c ?? 0;
    const orderCount = (await db.prepare("SELECT COUNT(*) as c FROM orders").get())?.c ?? 0;
    const categoryRows = (await db.prepare("SELECT id, slug FROM categories").all());
    const categoryBySlug = new Map((categoryRows || []).map((row) => [row.slug, row.id]));
    if (Number(authCount) === 0) {
        const adminId = await ensureAccount(db, "admin@klakoach.local", "Admin@1234", "ADMIN");
        const customerId = await ensureAccount(db, demoCustomer.email, demoCustomer.password, "CUSTOMER");
        await db.prepare("INSERT INTO customers(id,auth_account_id,name) VALUES(?,?,?)").run(uuid(), customerId, demoCustomer.name);
        await db.prepare("INSERT INTO admin_accounts(id,auth_account_id,display_name,clearance) VALUES(?,?,?,?)").run(uuid(), adminId, "Ops Director", "godmode");
        for (const artisan of demoArtisans) {
            const artisanAccountId = await ensureAccount(db, artisan.email, artisan.password, "ARTISAN");
            const artisanId = uuid();
            await db.prepare("INSERT INTO artisans(id,auth_account_id,studio_name,story,approved,featured) VALUES(?,?,?,?,1,?)")
                .run(artisanId, artisanAccountId, artisan.studioName, artisan.story, artisan.featured ?? 0);
            for (const product of artisan.products) {
                const categoryId = categoryBySlug.get(product.categorySlug);
                if (!categoryId)
                    continue;
                await db.prepare(`INSERT INTO products(id,artisan_id,category_id,title,slug,description,price_cents,status,image_url,featured)
           VALUES(?,?,?,?,?,?,?,?,?,?)`).run(product.id, artisanId, categoryId, product.title, product.slug, product.description, product.price_cents, product.status ?? "ACTIVE", product.image_url, product.featured ?? 0);
                await db.prepare("INSERT INTO inventory(id,product_id,quantity,reserved,low_stock_at) VALUES(?,?,?,?,?)")
                    .run(uuid(), product.id, product.inventory, 0, 3);
            }
        }
        const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(customerId));
        const seedProducts = (await db.prepare("SELECT id, price_cents FROM products ORDER BY created_at ASC LIMIT 2").all());
        if (customer && seedProducts && seedProducts.length > 0) {
            const orderId = uuid();
            const totalCents = seedProducts.reduce((sum, item) => sum + item.price_cents, 0);
            await db.prepare("INSERT INTO orders(id,customer_id,status,total_cents,fraud_score) VALUES(?,?,?,?,?)")
                .run(orderId, customer.id, "PAID", totalCents, 0.02);
            for (const item of seedProducts) {
                await db.prepare("INSERT INTO order_items(id,order_id,product_id,quantity,price_cents) VALUES(?,?,?,?,?)")
                    .run(uuid(), orderId, item.id, 1, item.price_cents);
            }
            try {
                await db.prepare("INSERT INTO reviews(id,customer_id,product_id,rating,body) VALUES(?,?,?,?,?)")
                    .run(uuid(), customer.id, seedProducts[0].id, 5, "The finish is exceptional and the piece feels genuinely made by hand.");
                await db.prepare("INSERT INTO reviews(id,customer_id,product_id,rating,body) VALUES(?,?,?,?,?)")
                    .run(uuid(), customer.id, seedProducts[1].id, 5, "Beautiful product photography, but the real piece is even better in person.");
            }
            catch { /* ignore duplicate review constraint */ }
            for (const artisan of demoArtisans.slice(0, 2)) {
                const artisanRow = (await db.prepare("SELECT id FROM artisans WHERE studio_name = ?").get(artisan.studioName));
                if (artisanRow) {
                    try {
                        await db.prepare("INSERT INTO artisan_follows(id,customer_id,artisan_id) VALUES(?,?,?)")
                            .run(uuid(), customer.id, artisanRow.id);
                    }
                    catch { /* ignore duplicate */ }
                }
            }
        }
    }
    if (Number(productCount) === 0 && Number(authCount) > 0) {
        const artisans = (await db.prepare("SELECT id, studio_name FROM artisans").all());
        if (artisans && artisans.length > 0) {
            const fallbackCategory = categoryRows?.[0]?.id;
            if (fallbackCategory) {
                const sampleProductId = uuid();
                await db.prepare(`INSERT INTO products(id,artisan_id,category_id,title,slug,description,price_cents,status,image_url,featured)
           VALUES(?,?,?,?,?,?,?,?,?,1)`).run(sampleProductId, artisans[0].id, fallbackCategory, "Signature Atelier Piece", "signature-atelier-piece", "Living catalog entry for the public storefront.", 199000, "ACTIVE", "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1200&q=85");
                await db.prepare("INSERT INTO inventory(id,product_id,quantity,reserved,low_stock_at) VALUES(?,?,?,?,?)")
                    .run(uuid(), sampleProductId, 8, 0, 3);
            }
        }
    }
    if (Number(orderCount) === 0 && Number(authCount) > 0) {
        const customer = (await db.prepare("SELECT id FROM customers LIMIT 1").get());
        const sampleProduct = (await db.prepare("SELECT id, price_cents FROM products ORDER BY created_at ASC LIMIT 1").get());
        if (customer && sampleProduct) {
            const orderId = uuid();
            await db.prepare("INSERT INTO orders(id,customer_id,status,total_cents,fraud_score) VALUES(?,?,?,?,?)")
                .run(orderId, customer.id, "PAID", sampleProduct.price_cents, 0.03);
            await db.prepare("INSERT INTO order_items(id,order_id,product_id,quantity,price_cents) VALUES(?,?,?,?,?)")
                .run(uuid(), orderId, sampleProduct.id, 1, sampleProduct.price_cents);
        }
    }
}
