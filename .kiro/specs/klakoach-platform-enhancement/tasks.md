# Implementation Plan: klakoach-platform-enhancement

## Overview

Implements four enhancement pillars on top of the existing React + TypeScript (Vite) / Node.js + Express + better-sqlite3 stack:
1. Stripe payment-intent checkout, webhooks, coupons, and refunds
2. Behavioural-signal-driven recommendation engine with SSE notifications
3. Artisan Studio earnings/payouts/media, Admin financials/order lifecycle, Customer Account Centre
4. Search improvements, security hardening, reconciliation job, and a property-based test suite

Tasks follow the implementation order from the design document. Each task builds on the previous ones; no orphaned code is left un-wired.

---

## Tasks

- [ ] 1. Schema migrations — add missing columns and verify Prisma models
  - [x] 1.1 Run Prisma migration to add `couponCode`, `discountCents`, `guestEmail` columns to the `orders` table and confirm `BrowseEvent` and `ArtisanPayout` tables exist
    - Edit `prisma/schema.prisma` if any model definition is missing; the current schema already has all three new models so focus on confirming the migration SQL is correct
    - Generate and apply migration: `npx prisma migrate dev --name platform-enhancement`
    - Verify with `npx prisma db pull` that the live DB reflects the new columns
    - _Requirements: 3.4, 15.2, 7.3_

  - [ ]* 1.2 Write a migration smoke test
    - Insert a row into `orders` using raw SQL and assert `coupon_code` and `discount_cents` columns accept values
    - Insert a `BrowseEvent` and an `ArtisanPayout` row and assert they are retrievable
    - _Requirements: 3.4, 4.1, 7.3_

- [ ] 2. Stripe integration — Payment_Service, webhook handler, checkout endpoint, refund endpoint
  - [ ] 2.1 Install the `stripe` npm package and add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` to the env validation in `server/src/index.ts`
    - `npm install stripe --save-exact` (use the latest stable)
    - Extend the production env validation array with `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
    - Create `server/src/services/stripe.client.ts` that exports a configured `Stripe` instance (reads `STRIPE_SECRET_KEY`)
    - _Requirements: 1.1, 2.1, 13.5_

  - [ ] 2.2 Implement `server/src/modules/payments/payment.service.ts`
    - Implement `createCheckoutIntent`: validate items and stock, call `Coupon_Service` if `couponCode` present, run atomic DB transaction (insert `Order` PENDING + `OrderItems` + increment `inventory.reserved`), call `stripe.paymentIntents.create`, insert `Payment` row with `REQUIRES_ACTION`, return `{ clientSecret, orderId, amountCents }`
    - Implement `refundOrder`: fetch `Payment` by `orderId`, verify order status is `PAID` or `DELIVERED`, call `stripe.refunds.create`, log to `activity_logs` with `ORDER_REFUNDED`, call `Notification_Service.create` for Customer
    - Implement `handleWebhookEvent`: route `payment_intent.succeeded` (idempotency guard → Order PAID, release `reserved`, notify customer+artisans), `payment_intent.payment_failed` (Order CANCELLED, release `reserved`), `charge.refunded` (Payment REFUNDED, release `reserved`)
    - Idempotency guard: `SELECT status FROM payments WHERE provider_payment_id = ?` — if already `SUCCEEDED` return immediately
    - _Requirements: 1.1–1.7, 2.1–2.5, 15.1–15.4_

  - [ ] 2.3 Implement `server/src/modules/payments/router.ts` and mount it
    - `POST /api/payments/checkout` — authenticate + `cart:checkout` permission + per-customer rate limiter (10 req / 10 min); call `payment.service.createCheckoutIntent`; guest checkout path when `guest_checkout_enabled = true`
    - `POST /api/payments/refund/:orderId` — authenticate + `orders:write` permission; call `payment.service.refundOrder`
    - `POST /api/webhooks/stripe` — `express.raw({ type: 'application/json' })` body parser, no auth middleware; call `stripe.webhooks.constructEvent`; on signature failure log `WEBHOOK_SIGNATURE_FAILED` to `activity_logs` and return 400; delegate to `payment.service.handleWebhookEvent`
    - Mount in `server/src/index.ts`: `/api/payments` and `/api/webhooks` (the stripe route must use raw body before the global JSON parser)
    - _Requirements: 1.1–1.7, 2.1–2.5, 13.3, 13.5, 15.1_

  - [ ]* 2.4 Write property test for payment idempotency (Property 1)
    - **Property 1: Payment Idempotency** — generate a random `providerPaymentId`; simulate calling `handleWebhookEvent` with `payment_intent.succeeded` twice; assert final `Order.status` equals `PAID` and `Payment.status` equals `SUCCEEDED` after both calls
    - **Validates: Requirements 15.1**

  - [ ]* 2.5 Write property test for atomic checkout rollback (Property 9)
    - **Property 9: Atomic Checkout Rollback** — inject a DB transaction failure after `Order` insert but before all `inventory.reserved` increments; assert no `Order` row exists and no `inventory.reserved` was incremented
    - **Validates: Requirements 15.2**

- [ ] 3. Coupon_Service — validate, apply, record
  - [ ] 3.1 Implement `server/src/modules/coupons/coupon.service.ts`
    - `validateAndApplyCoupon(code, originalTotalCents)`: query `coupons` table by `code`; throw `COUPON_INVALID` if not found or `active = false`; throw `COUPON_EXPIRED` if `expiresAt < now`; compute `discountCents = Math.floor(originalTotalCents * percentOff / 100)`; return `{ discountCents, couponId }`
    - Wire coupon validation into `payment.service.createCheckoutIntent`: apply discount before creating Stripe PaymentIntent; store `couponCode` and `discountCents` on the `Order` row
    - _Requirements: 3.1–3.5_

  - [ ]* 3.2 Write property test for coupon math (Property 3)
    - **Property 3: Coupon Math** — generate random `percentOff` (integer 1–100) and `originalTotalCents` (integer 100–1_000_000); assert `discountCents = Math.floor(originalTotalCents * percentOff / 100)` for all inputs; assert `amountCents = originalTotalCents - discountCents`
    - **Validates: Requirements 3.1**

- [ ] 4. Inventory_Service — atomic reserve/release, low-stock notifications with 24h dedup
  - [ ] 4.1 Implement `server/src/services/inventory.service.ts`
    - `reserveInventory(items)`: wraps `UPDATE inventory SET reserved = reserved + ? WHERE product_id = ?` for each item inside a single `db.transaction`; throws if available quantity < requested
    - `releaseInventory(orderId)`: fetches `order_items` for the order then runs `UPDATE inventory SET reserved = MAX(0, reserved - ?) WHERE product_id = ?` inside a transaction
    - `checkAndNotifyLowStock(productId)`: compute `available = quantity - reserved`; if `available <= lowStockAt`, check `activity_logs` for a `LOW_STOCK_NOTIFIED` entry for this `productId` within the last 24h; if none found, call `Notification_Service.create` for the artisan and insert a `LOW_STOCK_NOTIFIED` row into `activity_logs`
    - Replace inline inventory mutations in the existing `orders/router.ts` and the new `payment.service.ts` with calls to this service
    - _Requirements: 11.1–11.4, 15.2, 15.3_

  - [ ]* 4.2 Write property test for inventory conservation (Property 2)
    - **Property 2: Inventory Conservation** — generate random cart arrays; call `reserveInventory`; assert `SUM(order_items.quantity) === SUM(inventory.reserved increment)` for all items
    - **Validates: Requirements 15.2**

  - [ ]* 4.3 Write property test for low-stock dedup (Property 10)
    - **Property 10: Low-Stock Dedup** — simulate N checkout transactions (N between 2 and 20) all dropping the same product below its `lowStockAt` threshold within a 24h window; assert exactly one low-stock notification is created for that product
    - **Validates: Requirements 11.2**

- [ ] 5. Notification_Service and SSE_Gateway
  - [ ] 5.1 Implement `server/src/modules/notifications/notification.service.ts`
    - Export the `connectionPool`: `export const connectionPool = new Map<string, Set<express.Response>>()`
    - `create({ authAccountId, title, body })`: insert row into `notifications` table, then call `broadcast`
    - `broadcast(authAccountId, notification)`: iterate `connectionPool.get(authAccountId)`, write `event: notification\ndata: <JSON>\n\n` to each `Response`; catch write errors and remove dead connections from the pool
    - _Requirements: 6.1–6.6, 1.6, 2.5, 9.2_

  - [ ] 5.2 Implement `server/src/modules/realtime/router.ts` (SSE Gateway)
    - `GET /api/realtime/events`: check concurrent connection count against pool total; if ≥ 500 return 503 with `Retry-After: 5`
    - Set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`)
    - Read `?token=` query param; call `verifyAccess(token)`; on failure send `event: error\ndata: UNAUTHORIZED\n\n` and close
    - Register `res` in `connectionPool`; send `event: connected\ndata: {"ts":"..."}\n\n`
    - Start heartbeat `setInterval(() => res.write(': ping\n\n'), 30000)`
    - On `req.on('close')`: remove from pool, clear heartbeat interval
    - Mount in `server/src/index.ts` as `/api/realtime`
    - _Requirements: 6.1–6.6_

  - [ ] 5.3 Checkpoint — ensure Stripe webhook → Notification_Service → SSE pipeline compiles and all new service modules have no TypeScript errors
    - Run `npm run server:build` and resolve any type errors before continuing
    - _Requirements: 1.6, 6.2_

- [ ] 6. Recommendation_Engine — browse event capture + scoring algorithm + GET /api/recommendations
  - [ ] 6.1 Implement `server/src/services/behaviour.service.ts`
    - `recordEvent({ customerId, eventType, productId?, query? })`: insert `BrowseEvent` row; after insert, count total rows for customer; if count > 500, delete oldest rows to cap at 500 (`DELETE FROM browse_events WHERE customer_id = ? AND id NOT IN (SELECT id FROM browse_events WHERE customer_id = ? ORDER BY created_at DESC LIMIT 500)`)
    - _Requirements: 4.1–4.6_

  - [ ] 6.2 Implement `server/src/modules/recommendations/router.ts`
    - `POST /api/recommendations/event` — `authenticate` middleware; if not authenticated silently return 204; validate `{ eventType, productId?, query? }`; call `behaviour.service.recordEvent`
    - `GET /api/recommendations` — auth optional; if `productId` query param present: return up to 8 products sharing the same category with `|priceCents - targetPrice| <= 0.5 * targetPrice`, excluding out-of-stock, serialised as `Product` type
    - Personalised path: fetch last 500 `browse_events` for customer, `wishlists`, and all `ACTIVE` products with `inventory.quantity - inventory.reserved > 0`; compute `categoryAffinity` map from browse events; call `scoreProduct` for each candidate; exclude purchased products; sort descending; return top 12 — if fewer than 5 browse events, return top-12 by `avg_rating DESC`
    - Implement `scoreProduct` as defined in design: `(affinity/maxAffinity)*0.5 + (avgRating/5)*0.25 + (reviewCount>10 ? 0.1 : 0) + (wishlisted ? 0.3 : 0) + (daysSince(createdAt)<14 ? 0.15 : 0)`
    - Serialize all results using the existing `Product` shape from `api.ts`
    - Mount as `/api/recommendations` in `server/src/index.ts`
    - _Requirements: 4.1–4.6, 5.1–5.7_

  - [ ]* 6.3 Write property test for recommendation exclusion (Property 4)
    - **Property 4: Recommendation Exclusion** — generate a customer with arbitrary purchase history; call `GET /api/recommendations`; assert no returned product `id` appears in the customer's `order_items` (for PAID/FULFILLING/SHIPPED/DELIVERED orders)
    - **Validates: Requirements 5.3**

  - [ ]* 6.4 Write property test for recommendation stock filter (Property 5)
    - **Property 5: Recommendation Stock Filter** — for all products in any recommendation response, assert `inventory.quantity - inventory.reserved > 0`
    - **Validates: Requirements 5.4**

- [ ] 7. Artisan Studio enhancements — earnings endpoint, payouts endpoint, media upload/delete
  - [ ] 7.1 Add `GET /api/studio/earnings` to `server/src/modules/artisan/router.ts`
    - Check artisan `approved` flag; if `false` return `{ error: 'STUDIO_NOT_APPROVED' }` with HTTP 200
    - Query total lifetime revenue (sum `price_cents * quantity` for PAID/FULFILLING/SHIPPED/DELIVERED orders for this artisan's products)
    - Query per-product revenue breakdown
    - Query 30-day daily revenue series (`GROUP BY DATE(created_at)`)
    - Scope all data exclusively to the requesting artisan's `artisan.id`
    - _Requirements: 7.1–7.5_

  - [ ] 7.2 Add `GET /api/studio/payouts` to `server/src/modules/artisan/router.ts`
    - Check artisan `approved` flag
    - Query `artisan_payouts` table filtered by artisan id; return `amountCents`, `status`, `period`, `createdAt`
    - _Requirements: 7.3–7.5_

  - [ ] 7.3 Implement `server/src/middleware/upload.ts` and `POST /api/studio/products/:id/media`
    - Configure `multer` with `memoryStorage`, `limits: { fileSize: 5 * 1024 * 1024 }`, and MIME type filter for `image/jpeg`, `image/png`, `image/webp`; return `INVALID_MEDIA` on failure
    - Add `POST /api/studio/products/:id/media` to `server/src/modules/artisan/router.ts`: authenticate + `media:write`; verify artisan ownership (or ADMIN); count existing `product_media` rows — reject with 422 `MEDIA_LIMIT_EXCEEDED` if ≥ 8; save file to `uploads/` directory (or S3-compatible store); insert `ProductMedia` row with `url`, `alt` (from body or filename), `sortOrder`
    - Add `DELETE /api/studio/products/:id/media/:mediaId`: verify ownership; delete `ProductMedia` row
    - _Requirements: 14.1–14.5_

  - [ ] 7.4 Add per-artisan rate limiter for media upload (20 req / 1 hr) from the rate-limiting table in the design
    - Create `server/src/middleware/rate-limit.ts` exporting `mediaUploadLimiter` and `checkoutLimiter` using `express-rate-limit`
    - Apply `mediaUploadLimiter` to `POST /api/studio/products/:id/media`
    - Apply `checkoutLimiter` (10 req / 10 min, keyed by `req.user.sub`) to `POST /api/payments/checkout`
    - _Requirements: 13.3_

- [ ] 8. Admin enhancements — financials, order detail, bulk update, inactive admins, payout management
  - [ ] 8.1 Add `GET /api/admin/financials` to `server/src/modules/admin/router.ts`
    - Require `analytics:read` permission
    - Accept `from` and `to` ISO 8601 query params; default to last 30 days when absent
    - Compute: total GMV (PAID/FULFILLING/SHIPPED/DELIVERED), total refund amount (REFUNDED orders), estimated Stripe fees (`gmv * 0.029 + transactionCount * 30`), total artisan payouts disbursed, net platform revenue
    - Return per-artisan breakdown: `studioName`, `totalRevenueCents`, `unitsSold`, `payoutStatus`
    - _Requirements: 8.1–8.5_

  - [ ] 8.2 Add `GET /api/admin/orders/:id` to `server/src/modules/admin/router.ts`
    - Return full order detail: customer name, items (title, quantity, priceCents, imageUrl), payment record, shipping record (carrier, trackingNumber, status), fraud score
    - _Requirements: 9.3_

  - [ ] 8.3 Enhance `PATCH /api/admin/orders/:id/status` (already exists in `orders/router.ts`)
    - Add transition graph validation: `PENDING→PAID`, `PAID→FULFILLING`, `FULFILLING→SHIPPED`, `SHIPPED→DELIVERED`, `PAID→REFUNDED`, `PENDING→CANCELLED`, `FULFILLING→CANCELLED`; return 422 `INVALID_STATUS_TRANSITION` for any other move
    - For `SHIPPED`: require `trackingNumber` and `carrier` in body; return 400 `TRACKING_REQUIRED` if absent; upsert `shipping` row; call `Notification_Service.create` for Customer with "Your order has shipped"
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ] 8.4 Add `PATCH /api/admin/orders/bulk` to `server/src/modules/admin/router.ts`
    - Accept `{ orders: [{ id, status, trackingNumber?, carrier? }] }` (max 50)
    - Process each order individually using the same transition graph from 8.3; collect per-order success/failure results; return `{ results: [{ id, success, error? }] }` — do not abort the batch on individual failures
    - _Requirements: 9.4_

  - [ ] 8.5 Add `GET /api/admin/security/inactive-admins` to `server/src/modules/admin/router.ts`
    - Query `auth_accounts` where `kind = 'ADMIN'`; left-join `activity_logs` for `action = 'LOGIN'` and `created_at > now - 30 days`; return accounts with no matching login log entry
    - _Requirements: 13.4_

  - [ ] 8.6 Add `PATCH /api/admin/payouts/:artisanId` to `server/src/modules/admin/router.ts`
    - Require `analytics:read` permission
    - Update the artisan's most recent PENDING `artisan_payouts` row status to `PROCESSING`; log to `activity_logs` with action `PAYOUT_INITIATED`
    - _Requirements: 8.3_

- [ ] 9. Customer Account Centre — profile, addresses, enhanced order history
  - [ ] 9.1 Implement `server/src/modules/customer/router.ts`
    - `GET /api/customer/profile` — `authenticate` + `cart:checkout` permission; join `customers` + `auth_accounts` for `name` + `email`; return saved `Address` rows and aggregate `orderCount`
    - `PATCH /api/customer/profile` — validate `name` (non-empty string); update `customers.name`; return 200
    - `POST /api/customer/addresses` — validate `line1`, `city`, `country`, `postal` all present; return 400 `VALIDATION_ERROR` if any missing; insert `Address` row; return new row
    - `GET /api/customer/orders` — full order history with status, totalCents, itemCount, and `payment.status` (joined from `payments` table)
    - Mount as `/api/customer` in `server/src/index.ts`
    - _Requirements: 10.1–10.6_

  - [ ] 9.2 Add `customer` namespace to `api.ts` in the frontend
    - Add `customer.profile()`, `customer.updateProfile(body)`, `customer.addAddress(body)`, `customer.orders()` methods following the existing pattern in `src/lib/api.ts`
    - Add `CustomerProfile`, `Address`, `CustomerOrder` types
    - _Requirements: 10.1–10.6_

- [ ] 10. Search enhancements — price/rating/stock filters, pagination cap
  - [ ] 10.1 Extend `GET /api/products` in `server/src/modules/products/router.ts`
    - Add `minPrice`, `maxPrice` query params (integer paise; treat 0 as no-filter); append `AND p.price_cents >= ?` / `AND p.price_cents <= ?` to WHERE clause
    - Add `minRating` param (1–5); join `reviews` aggregate subquery and filter `avg_rating >= ?`
    - Add `inStock` boolean param; filter `inventory.quantity - inventory.reserved > 0` when true
    - Cap `limit` at 48; when `search` is empty and no filters, sort by `created_at DESC`
    - Rank non-empty search results by `(title LIKE ?) DESC, avg_rating DESC, stock DESC` (SQLite FTS or LIKE-based, depending on DB)
    - _Requirements: 12.1–12.5_

- [ ] 11. Security hardening — account lockout, per-endpoint rate limits, inactive admin detection
  - [ ] 11.1 Add account lockout to `server/src/modules/auth/router.ts`
    - On each failed login, increment a `failed_attempts` counter stored in `activity_logs` by checking count of `LOGIN_FAILED` rows for the email within the last 15 minutes
    - Read `max_login_attempts` from `site_settings`; if `failedCount >= maxLoginAttempts`, return 423 `ACCOUNT_LOCKED`
    - Reset failed attempt count on successful login (no explicit reset needed — window naturally expires)
    - _Requirements: 13.2_

  - [ ] 11.2 Verify and harden existing rate limiters in `server/src/index.ts`
    - Confirm `authLimiter` is `20 req / 15 min / IP` and returns `Retry-After` header — `express-rate-limit` v6+ sets `standardHeaders: true` which includes `Retry-After`
    - Apply `authLimiter` to `POST /api/auth/register` (10 req / 1 hr) in addition to login
    - Confirm `checkoutLimiter` from task 7.4 is applied to the payments checkout route
    - _Requirements: 13.1, 13.3_

- [ ] 12. Frontend wiring — CartDrawer Stripe Elements, SSE hook + notification bell, recommendation events, new admin/artisan/customer tabs
  - [ ] 12.1 Integrate Stripe Elements into `src/components/CartDrawer.tsx`
    - Install `@stripe/stripe-js` and `@stripe/react-stripe-js`
    - Replace `api.orders.checkout(payload)` call with `api.payments.checkout(payload)` (new endpoint returning `clientSecret`)
    - Add coupon code `<input>` and "Apply" button; call a new `api.payments.validateCoupon(code)` method that hits `POST /api/payments/checkout` with coupon before confirming; display discount amount
    - Wrap the checkout form in `<Elements stripe={stripePromise}>` and use `useStripe()` + `useElements()` to call `stripe.confirmPayment(clientSecret, ...)`
    - On payment confirmation, show order-done state with order id
    - Add `payments.checkout`, `payments.refund` methods to `src/lib/api.ts`
    - _Requirements: 1.1, 1.5, 3.1–3.5_

  - [ ] 12.2 Implement SSE store and notification bell in `src/store/sse.ts` and update `src/components/Navbar.tsx` / `src/components/TopBar.tsx`
    - Create `src/store/sse.ts` with a Zustand store: `{ connected, unreadCount, notifications, connect(token), disconnect() }`
    - `connect`: open `EventSource(/api/realtime/events?token=<token>)`; handle `notification` events (parse JSON, append to store, increment `unreadCount`, trigger `useToast`); handle `connected` and `error` events with exponential back-off reconnect
    - Add a notification bell icon to `Navbar.tsx`/`TopBar.tsx`: badge showing `unreadCount`; click opens dropdown listing recent notifications; clicking a notification calls `api.studio.markRead(id)` and decrements count
    - Wire `connect(token)` on login in `src/store/index.ts` (after `setAccessToken`); call `disconnect()` on logout
    - _Requirements: 6.1–6.6_

  - [ ] 12.3 Fire recommendation events from `src/components/MarketplacePage.tsx` and `src/components/SearchModal.tsx`
    - In `MarketplacePage`: use `IntersectionObserver` on product cards to fire `POST /api/recommendations/event { eventType:'VIEW', productId }` when a card enters the viewport; add "Add to cart" handler to also fire `CART_ADD` event; add a "Recommended for You" section that calls `GET /api/recommendations` and renders a product grid
    - In `SearchModal`: fire `POST /api/recommendations/event { eventType:'SEARCH', query }` on debounced search; pass `minPrice`, `maxPrice`, `minRating` filter params to `api.products.list`
    - Add `recommendations.get(params?)` and `recommendations.recordEvent(body)` to `src/lib/api.ts`
    - _Requirements: 4.1–4.3, 5.1, 5.5_

  - [ ] 12.4 Add new tabs to `src/components/ArtisanPage.tsx`
    - "Earnings" tab: fetch `api.studio.earnings()` (new method); display total revenue, 30-day daily chart (reuse `recharts` already in deps), per-product table; show `STUDIO_NOT_APPROVED` message if returned
    - "Payouts" tab: fetch `api.studio.payouts()` (new method); render payout table with amount, status badge, period
    - "Media" section in product edit: file input wired to `api.studio.uploadMedia(productId, file)` and `api.studio.deleteMedia(productId, mediaId)` (new methods)
    - Add all new API methods to `src/lib/api.ts`
    - _Requirements: 7.1–7.4, 14.1–14.4_

  - [ ] 12.5 Add new tabs to `src/components/AdminPage.tsx`
    - "Financials" tab: fetch `api.admin.financials(from, to)`; display GMV, refunds, fees, net revenue cards; render per-artisan breakdown table; date-range picker for `from`/`to`
    - "Order Detail" modal: on order row click, fetch `api.admin.orderDetail(id)`; show customer, items, payment, shipping, fraud score; "Refund" button calls `api.payments.refund(orderId)`; "Ship" button shows modal for `trackingNumber`+`carrier` then calls `api.admin.updateOrderStatus(id, { status:'SHIPPED', trackingNumber, carrier })`
    - "Payout Management" row in Artisans tab: "Set Processing" button calls `api.admin.setPayout(artisanId)`
    - "Inactive Admins" panel in Security tab: fetch `api.admin.inactiveAdmins()` and display list
    - Bulk update: add checkbox column to orders table; "Bulk Update Status" dropdown calls `api.admin.bulkUpdateOrders(selectedIds, status)`
    - Add all new admin API methods to `src/lib/api.ts`
    - _Requirements: 8.1–8.5, 9.1–9.5, 2.1_

  - [ ] 12.6 Add "Profile" tab to `src/components/CustomerPage.tsx`
    - New `Tab` value: `"profile"`
    - Fetch `api.customer.profile()` on tab activation; display and inline-edit `name`; show address list; "Add Address" form (line1, city, country, postal) calling `api.customer.addAddress(body)`
    - Update the Orders tab to use `api.customer.orders()` (replacing `api.orders.mine()`) to get payment status in the response
    - _Requirements: 10.1–10.6_

  - [ ] 12.7 Checkpoint — run `npm run build` (frontend) and `npm run server:build` (backend); resolve all TypeScript compile errors
    - _Requirements: all_

- [ ] 13. Reconciliation job — stale PENDING order cleanup on server start and interval
  - [ ] 13.1 Implement `server/src/services/reconciliation.job.ts`
    - `runReconciliation()`: query all `orders` with `status = 'PENDING'` and `created_at < now - 30 minutes`; for each, call `stripe.paymentIntents.retrieve(payment.providerPaymentId)`; if status is `succeeded`: call `payment.service.handleWebhookEvent` with a synthetic `payment_intent.succeeded` event; if status is `canceled` or `payment_failed`: set order to `CANCELLED` and call `inventory.service.releaseInventory`; on Stripe API error log `RECONCILIATION_ERROR` to `activity_logs` and skip the order
    - Export `startReconciliationJob()`: call `runReconciliation()` once immediately, then `setInterval(runReconciliation, 5 * 60 * 1000)` (every 5 minutes)
    - Import and call `startReconciliationJob()` at the bottom of `server/src/index.ts` after `app.listen`
    - _Requirements: 15.5_

- [ ] 14. Property-based test suite — verify all 10 correctness properties
  - [ ] 14.1 Set up the property-based testing framework
    - Install `fast-check` and `vitest` as dev dependencies (exact versions)
    - Add a `test` script to `package.json`: `"test": "vitest --run"`
    - Create `server/src/test/setup.ts` with in-memory SQLite DB bootstrap for isolated test runs
    - _Requirements: all correctness properties_

  - [ ]* 14.2 Write property test for Payment Idempotency (Property 1)
    - **Property 1: Payment Idempotency** — `fc.string()` for `providerPaymentId`; call `handleWebhookEvent` twice with the same id; assert `Order.status === 'PAID'` and DB row count for that order = 1
    - **Validates: Requirements 15.1**

  - [ ]* 14.3 Write property test for Inventory Conservation (Property 2)
    - **Property 2: Inventory Conservation** — `fc.array(fc.record({ productId: fc.string(), quantity: fc.integer({min:1,max:10}) }), {minLength:1,maxLength:10})`; call `reserveInventory`; assert sum of increments equals sum of requested quantities
    - **Validates: Requirements 15.2**

  - [ ]* 14.4 Write property test for Coupon Math (Property 3)
    - **Property 3: Coupon Math** — `fc.integer({min:1,max:100})` × `fc.integer({min:100,max:1_000_000})`; assert `Math.floor(T * p / 100) === discountCents`
    - **Validates: Requirements 3.1**

  - [ ]* 14.5 Write property test for Recommendation Exclusion (Property 4)
    - **Property 4: Recommendation Exclusion** — generate customer with arbitrary purchase history; call recommendation scorer; assert intersection of result ids and purchased product ids is empty
    - **Validates: Requirements 5.3**

  - [ ]* 14.6 Write property test for Recommendation Stock Filter (Property 5)
    - **Property 5: Recommendation Stock Filter** — generate product pool including out-of-stock items; call scorer; assert all returned products have `available > 0`
    - **Validates: Requirements 5.4**

  - [ ]* 14.7 Write property test for SSE Delivery Bound (Property 6)
    - **Property 6: SSE Delivery Bound** — create mock SSE connections; call `Notification_Service.create`; assert all mock write callbacks are invoked within 2000ms
    - **Validates: Requirements 6.2**

  - [ ]* 14.8 Write property test for RBAC Boundary (Property 7)
    - **Property 7: RBAC Boundary** — `fc.constantFrom('ARTISAN','CUSTOMER')`; assert request to `GET /api/admin/financials` with those roles returns 403; assert `GET /api/studio/earnings` with CUSTOMER role returns 403
    - **Validates: Requirements 7.2, 8.5**

  - [ ]* 14.9 Write property test for Refund Eligibility (Property 8)
    - **Property 8: Refund Eligibility** — `fc.constantFrom('PENDING','FULFILLING','SHIPPED','CANCELLED','REFUNDED')`; assert refund request for order in any of those statuses returns 422 `REFUND_NOT_ELIGIBLE`; assert `PAID` and `DELIVERED` return success
    - **Validates: Requirements 2.3**

  - [ ]* 14.10 Write property test for Atomic Checkout Rollback (Property 9)
    - **Property 9: Atomic Checkout Rollback** — inject fault at varying steps of the `reserveInventory` transaction; assert no `Order` row and no `reserved` increment persists after the fault
    - **Validates: Requirements 15.2**

  - [ ]* 14.11 Write property test for Low-Stock Dedup (Property 10)
    - **Property 10: Low-Stock Dedup** — `fc.integer({min:2,max:20})` triggers within a 24h window; assert notification count = 1
    - **Validates: Requirements 11.2**

- [ ] 15. Final checkpoint — ensure all tests pass
  - Run `npm run test` and confirm all non-optional (non-`*`) unit tests pass
  - Run `npm run build` and `npm run server:build`; resolve any remaining TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- Each task references specific requirements for traceability.
- The implementation order follows the dependency chain: schema → services → endpoints → frontend wiring → tests.
- The `stripe` raw-body webhook route MUST be registered before `express.json()` applies to the `/api/webhooks/stripe` path.
- `fast-check` properties for the recommendation engine can run against the pure `scoreProduct` function without a running DB.
- The `IntersectionObserver` event firing in task 12.3 should be debounced (one VIEW event per product per 5s) to avoid flooding the `browse_events` table.
- The SSE `?token=` workaround is needed because `EventSource` does not support custom headers.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.2", "4.3", "5.2", "9.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "6.1", "7.1", "7.2", "8.1", "8.2", "8.5", "9.2", "10.1"] },
    { "id": 4, "tasks": ["2.4", "2.5", "6.2", "7.3", "7.4", "8.3", "8.4", "8.6", "11.1", "11.2"] },
    { "id": 5, "tasks": ["5.3", "6.3", "6.4", "12.1", "12.2", "13.1"] },
    { "id": 6, "tasks": ["12.3", "12.4", "12.5", "12.6", "14.1"] },
    { "id": 7, "tasks": ["12.7", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9", "14.10", "14.11"] }
  ]
}
```
