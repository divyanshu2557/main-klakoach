# Technical Design Document

## Feature: klakoach-platform-enhancement

---

## Overview

This document describes the technical architecture for massively enhancing the Klakoach artisan marketplace platform. The existing React + TypeScript (Vite) frontend backed by a Node.js/Express + Prisma + SQLite/PostgreSQL server will be extended across four pillars:

1. **Payment Gateway Integration** — Full Stripe PaymentIntent lifecycle replacing the current PENDING-only checkout stub, including webhooks, refunds, and coupon redemption.
2. **Personalised Recommendations** — On-platform behavioural signal capture (VIEW, CART_ADD, SEARCH events) feeding a weighted scoring engine that returns ranked product recommendations.
3. **God-level Backend Quality** — Real-time Server-Sent Events notification gateway, artisan earnings/payout endpoints, admin financial reconciliation, enhanced order management, customer account centre, artisan inventory alerts, and security hardening.
4. **World-class Platform Features** — Artisan multi-image media uploads, platform-wide search improvements, and end-to-end data integrity guarantees.

Every frontend button and tab is mapped to a concrete backend endpoint. No stub or mock logic remains after implementation.

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                      │
│  CartDrawer  SearchModal  MarketplacePage  CustomerPage  AdminPage  │
│  ArtisanPage  LandingExperience  AIChatWidget  NotificationBell    │
│                        src/lib/api.ts  (HTTP + SSE)                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────────────┐
│               EXPRESS SERVER  (server/src/index.ts)                 │
│                                                                     │
│  /api/auth      /api/products   /api/orders    /api/studio          │
│  /api/admin     /api/ai         /api/realtime  /api/customer        │
│  /api/payments  /api/recommendations  /api/webhooks/stripe          │
│                                                                     │
│  Middleware stack:                                                  │
│  helmet → cors → cookieParser → requestId → globalRateLimit        │
│  → siteGuard → authenticate → requirePermission                    │
└──────┬──────────┬──────────┬──────────────────┬─────────────────────┘
       │          │          │                  │
┌──────▼──┐ ┌────▼────┐ ┌──▼──────────┐ ┌─────▼──────┐
│Payment  │ │Recommend│ │Notification │ │SSE         │
│Service  │ │Engine   │ │Service      │ │Gateway     │
│(Stripe) │ │(scorer) │ │(writer+push)│ │(conn pool) │
└──────┬──┘ └────┬────┘ └──┬──────────┘ └─────┬──────┘
       │         │         │                   │
┌──────▼─────────▼─────────▼───────────────────▼──────┐
│             PostgreSQL / SQLite via Prisma            │
│  auth_accounts · customers · artisans · products     │
│  orders · order_items · payments · inventory         │
│  browse_events · notifications · coupons             │
│  artisan_payouts · product_media · shipping          │
│  addresses · sessions · activity_logs                │
└──────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────┐
│  External Services       │
│  Stripe API + Webhooks   │
│  File storage (local /   │
│   S3-compatible)         │
└─────────────────────────┘
```

### New Module File Structure

```
server/src/
├── modules/
│   ├── payments/
│   │   ├── router.ts           # POST /api/payments/checkout, POST /api/payments/refund/:id
│   │   └── payment.service.ts  # Stripe PaymentIntent, refund, idempotency
│   ├── recommendations/
│   │   └── router.ts           # GET /api/recommendations, POST /api/recommendations/event
│   ├── realtime/
│   │   └── router.ts           # GET /api/realtime/events (SSE)
│   ├── customer/
│   │   └── router.ts           # GET/PATCH /api/customer/profile, addresses, orders
│   ├── coupons/
│   │   └── coupon.service.ts   # validate, apply, record
│   └── notifications/
│       └── notification.service.ts  # create + broadcast to SSE pool
├── services/
│   ├── behaviour.service.ts    # browse_events insert + capped retention
│   ├── inventory.service.ts    # atomic reserve/release + low-stock check
│   └── reconciliation.job.ts  # cron: fix stale PENDING orders
└── middleware/
    ├── rate-limit.ts           # per-endpoint limiters
    └── upload.ts               # multer config for product media
```

### Stripe Payment Flow

```
Customer clicks "Checkout →"
        │
        ▼
POST /api/payments/checkout
        │  validates items + coupon
        │  atomic DB tx: Order(PENDING) + OrderItems + inventory.reserved++
        │  stripe.paymentIntents.create(amountCents, currency:'inr')
        │  inserts Payment(REQUIRES_ACTION)
        │  returns { clientSecret, orderId }
        ▼
Frontend: stripe.confirmPayment(clientSecret, elements)
        │
        ├─ success ──► Stripe sends webhook: payment_intent.succeeded
        │              └► Order→PAID, inventory.reserved--, notify customer+artisans
        │
        └─ failure ──► Stripe sends webhook: payment_intent.payment_failed
                       └► Order→CANCELLED, inventory released atomically
```

### SSE Connection Lifecycle

```
Client: GET /api/realtime/events  (Authorization: Bearer <token>)
        │
        ▼
Server sets SSE headers (200, text/event-stream, no-cache)
        │
        ▼
Verify JWT → if invalid: send error event, close
        │
        ▼
Register res in connectionPool Map<authAccountId, Set<Response>>
Send: event: connected\ndata: {"ts":"..."}\n\n
        │
        ├─ Every 30s: ": ping\n\n"
        │
        ├─ On Notification_Service.create(authAccountId):
        │  iterate connectionPool.get(authAccountId) → write event: notification frame
        │
        └─ On client disconnect: remove from pool, clear heartbeat interval
```

---

## Components and Interfaces

### Payment_Service

```typescript
interface PaymentService {
  createCheckoutIntent(params: {
    customerId: string;
    items: Array<{ productId: string; quantity: number }>;
    couponCode?: string;
    guestEmail?: string;
  }): Promise<{ clientSecret: string; orderId: string; amountCents: number }>;

  refundOrder(orderId: string, adminAccountId: string): Promise<void>;

  handleWebhookEvent(event: Stripe.Event): Promise<void>;
}
```

Idempotency guard: before processing any `payment_intent.succeeded`, query `SELECT status FROM payments WHERE provider_payment_id = ?`. If already `SUCCEEDED` → return 200 immediately, no state mutation.

### Coupon_Service

```typescript
function validateAndApplyCoupon(
  code: string,
  originalTotalCents: number
): { discountCents: number; couponId: string }
// Throws COUPON_INVALID if not found or inactive
// Throws COUPON_EXPIRED if expiresAt < now
// Math: discountCents = Math.floor(originalTotalCents * percentOff / 100)
```

### Notification_Service

```typescript
interface NotificationService {
  create(params: {
    authAccountId: string;
    title: string;
    body: string;
  }): Promise<void>;
  // Inserts DB row + calls broadcast

  broadcast(authAccountId: string, notification: Notification): void;
  // Iterates SSE connectionPool.get(authAccountId) and writes event frame
}
```

SSE connection pool (module-level singleton):
```typescript
export const connectionPool = new Map<string, Set<express.Response>>();
```

### Recommendation_Engine

Scoring algorithm (pure TypeScript, no external ML):

```typescript
function scoreProduct(product: Product, signals: CustomerSignals): number {
  const affinity = signals.categoryAffinity[product.categoryId] ?? 0;
  const maxAffinity = Math.max(...Object.values(signals.categoryAffinity), 1);
  const wishlisted = signals.wishlistedIds.has(product.id) ? 0.3 : 0;
  const newness = daysSince(product.createdAt) < 14 ? 0.15 : 0;
  return (affinity / maxAffinity) * 0.5
       + (product.avgRating / 5) * 0.25
       + (product.reviewCount > 10 ? 0.1 : 0)
       + wishlisted
       + newness;
}
```

Data fetched in ≤ 3 queries:
1. `browse_events` for customer (last 500 rows)
2. `wishlists` for customer
3. `products` with `ACTIVE` status and `inventory.quantity > 0`

### Inventory_Service

```typescript
// All mutations wrapped in db.transaction()
function reserveInventory(items: CheckoutItem[]): void
function releaseInventory(orderId: string): void
function checkAndNotifyLowStock(productId: string): void
// Dedup: checks activity_logs for LOW_STOCK_NOTIFIED within 24h before inserting notification
```

### Frontend SSE Hook

```typescript
// src/store/sse.ts
export const useSSE = create<SSEStore>((set) => ({
  connected: false,
  unreadCount: 0,
  connect: (token: string) => {
    // EventSource doesn't support custom headers
    // Workaround: pass token as short-lived query param
    const es = new EventSource(`/api/realtime/events?token=${token}`);
    es.addEventListener('notification', (e) => {
      const notif = JSON.parse(e.data);
      // append to notifications store, increment unreadCount, show Toast
    });
    es.addEventListener('connected', () => set({ connected: true }));
    es.addEventListener('error', () => {
      set({ connected: false });
      // exponential backoff reconnect
    });
  },
  disconnect: () => { /* close EventSource */ },
}));
```

### Frontend–Backend Integration Map

Every UI element mapped to its backend endpoint:

**CartDrawer** (`src/components/CartDrawer.tsx`)
- "Checkout →" button → `POST /api/payments/checkout` → returns `clientSecret` → Stripe Elements
- Coupon input (new) → inline validation against `POST /api/payments/validate-coupon`

**SearchModal** (`src/components/SearchModal.tsx`)
- Text input (debounce) → `GET /api/products?search=&minPrice=&maxPrice=&minRating=` + fires `POST /api/recommendations/event { eventType:'SEARCH' }`
- Product row click → `add(product)` to cart + fires `POST /api/recommendations/event { eventType:'CART_ADD' }`
- Camera icon → `POST /api/ai/visual-search` (unchanged)

**MarketplacePage** (`src/components/MarketplacePage.tsx`)
- Product card visible (IntersectionObserver) → `POST /api/recommendations/event { eventType:'VIEW', productId }`
- "Add to cart" button → `add(product)` + `CART_ADD` event
- Recommendations section → `GET /api/recommendations`
- Wishlist ♡ → `api.studio.toggleWishlist(productId)`

**CustomerPage** (`src/components/CustomerPage.tsx`)
- Browse tab search → `GET /api/products?search=...&minPrice=&maxPrice=&minRating=`
- Orders tab → `GET /api/customer/orders`
- Wishlist tab → `GET /api/studio/wishlist`
- Notifications tab → `GET /api/studio/notifications` (+ SSE push updates)
- Profile tab (new) → `GET /api/customer/profile`, `PATCH /api/customer/profile`
- Add Address button (new) → `POST /api/customer/addresses`

**ArtisanPage / Studio** (`src/components/ArtisanPage.tsx`)
- Earnings tab (new) → `GET /api/studio/earnings`
- Payouts tab (new) → `GET /api/studio/payouts`
- Upload image button → `POST /api/studio/products/:id/media`
- Delete image → `DELETE /api/studio/products/:id/media/:mediaId`
- Low stock alerts → pushed via SSE

**AdminPage** (`src/components/AdminPage.tsx`)
- Financials tab (new) → `GET /api/admin/financials?from=&to=`
- Order detail modal → `GET /api/admin/orders/:id`
- Ship order status → `PATCH /api/admin/orders/:id/status` (requires `trackingNumber`, `carrier`)
- Bulk status update → `PATCH /api/admin/orders/bulk`
- Refund button → `POST /api/payments/refund/:orderId`
- Payout → PROCESSING → `PATCH /api/admin/payouts/:artisanId`
- Inactive admins panel → `GET /api/admin/security/inactive-admins`

**Notification Bell** (Navbar/TopBar — new)
- Unread count badge → driven by `useSSE` store
- Bell click → renders notifications from store
- Mark read → `PATCH /api/studio/notifications/:id/read`

---

## Data Models

### New Prisma Models (additions to schema.prisma)

```prisma
model BrowseEvent {
  id         String   @id @default(cuid())
  customerId String
  productId  String?
  eventType  String   // VIEW | CART_ADD | SEARCH
  query      String?
  createdAt  DateTime @default(now())

  @@index([customerId, createdAt])
  @@index([customerId, productId])
}

model ArtisanPayout {
  id          String   @id @default(cuid())
  artisanId   String
  artisan     Artisan  @relation(fields: [artisanId], references: [id])
  amountCents Int
  status      String   @default("PENDING") // PENDING | PROCESSING | PAID
  period      String   // e.g. "2025-06"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([artisanId, status])
}
```

### Existing Models — Additive Column Migrations

**Order model** — new optional columns:
```
couponCode     String?
discountCents  Int       @default(0)
guestEmail     String?
```

**Shipping model** — `trackingNumber` already present; `carrier` already present as a column.

### Confirmed Existing Models (no changes needed)

`Payment`, `ProductMedia`, `Notification`, `Address`, `Shipping`, `Coupon`, `AnalyticsSnapshot` — all already in `prisma/schema.prisma`.

### API Endpoint Reference

#### Payment Endpoints

`POST /api/payments/checkout`
- Auth: Bearer, `cart:checkout`; rate limit: 10 req / 10 min per customer
- Body: `{ items: [{productId, quantity}], couponCode?, guestEmail? }`
- Returns: `{ clientSecret, orderId, amountCents }`
- Errors: `PRODUCT_UNAVAILABLE` 400, `INSUFFICIENT_STOCK` 400, `COUPON_INVALID` 400, `COUPON_EXPIRED` 400, `CHECKOUT_RATE_LIMITED` 429

`POST /api/payments/refund/:orderId`
- Auth: Bearer, `orders:write` (ADMIN only)
- Errors: `REFUND_NOT_ELIGIBLE` 422, `ORDER_NOT_FOUND` 404

`POST /api/webhooks/stripe`
- Raw body (express.raw), no auth middleware; uses `stripe.webhooks.constructEvent`
- Handled events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- Invalid signature → 400, logged to `activity_logs`

#### Recommendation Endpoints

`GET /api/recommendations`
- Auth: optional; `productId` query param triggers similarity mode
- Returns: array of `Product` (≤12 personalised or ≤8 similar)
- SLA: ≤ 500ms for up to 500 browse events

`POST /api/recommendations/event`
- Auth: Bearer (CUSTOMER); silently no-ops for unauthenticated
- Body: `{ eventType: 'VIEW'|'CART_ADD'|'SEARCH', productId?, query? }`

#### SSE Gateway

`GET /api/realtime/events`
- Auth: Bearer in query param `?token=...`
- Connection cap: 500 concurrent; excess → 503 `Retry-After: 5`
- Heartbeat: `: ping` every 30s

#### Artisan Studio Endpoints (new)

`GET /api/studio/earnings` — lifetime revenue, per-product breakdown, 30-day daily series
`GET /api/studio/payouts` — payout records list
`POST /api/studio/products/:id/media` — multipart image upload (max 5MB, max 8 images/product)
`DELETE /api/studio/products/:id/media/:mediaId` — remove media item

#### Admin Endpoints (new)

`GET /api/admin/financials?from=&to=` — GMV, refunds, Stripe fees estimate, per-artisan breakdown
`GET /api/admin/orders/:id` — full order detail with payment + shipping + fraud score
`PATCH /api/admin/orders/bulk` — batch status update (max 50 orders per request)
`PATCH /api/admin/orders/:id/status` — enhanced: requires `trackingNumber`+`carrier` for SHIPPED; validates transition graph
`GET /api/admin/security/inactive-admins` — admins with no LOGIN event in 30 days
`PATCH /api/admin/payouts/:artisanId` — set payout status to PROCESSING

#### Customer Account Endpoints (new)

`GET /api/customer/profile` — name, email, addresses, orderCount
`PATCH /api/customer/profile` — update name
`POST /api/customer/addresses` — add address (line1, city, country, postal required)
`GET /api/customer/orders` — full order history with paymentStatus

#### Search Enhancements (existing endpoint extended)

`GET /api/products?search=&minPrice=&maxPrice=&minRating=&inStock=&page=&limit=`
- `limit` capped at 48; empty query → sorted by `created_at DESC`
- `minPrice`/`maxPrice` = 0 treated as "no filter"

### Rate Limiting Table

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 20 req / IP | 15 min |
| `POST /api/auth/register` | 10 req / IP | 1 hour |
| `POST /api/payments/checkout` | 10 req / customer | 10 min |
| `POST /api/studio/products/:id/media` | 20 req / artisan | 1 hour |
| Global | 120 req / IP | 1 min |
| SSE connections | 500 concurrent total | — |

---

## Correctness Properties

These properties define the formal specification and must be enforced and verified by property-based tests:

### Property 1: Payment Idempotency

For all `payment_intent.succeeded` webhook events with the same `providerPaymentId`, processing the event twice produces the same final `Order.status` as processing it once. Duplicate deliveries return HTTP 200 without re-mutation.

**Validates: Requirements 15.1**

### Property 2: Inventory Conservation

For all checkouts, `sum(order_items.quantity)` equals `sum(inventory.reserved increment)` for all items in that order, within the same atomic transaction.

**Validates: Requirements 15.2**

### Property 3: Coupon Math

For all coupons with `percentOff = p` and order total `T`, `discountCents = floor(T × p / 100)`. The Stripe PaymentIntent is created with `T - discountCents`.

**Validates: Requirements 3.1**

### Property 4: Recommendation Exclusion

For all customers C, `GET /api/recommendations` never returns a product that appears in C's purchase history (`order_items` with PAID/FULFILLING/SHIPPED/DELIVERED orders).

**Validates: Requirements 5.3**

### Property 5: Recommendation Stock Filter

For all recommendation responses, every returned product has `inventory.quantity - inventory.reserved > 0`.

**Validates: Requirements 5.4**

### Property 6: SSE Delivery Bound

For all notifications N created for account A, N is pushed to all active SSE connections for A within 2000ms of creation.

**Validates: Requirements 6.2**

### Property 7: RBAC Boundary

For all ARTISAN requests to `GET /api/admin/financials`, response status = 403. For all CUSTOMER requests to `GET /api/studio/earnings`, response status = 403.

**Validates: Requirements 7.2, 8.5**

### Property 8: Refund Eligibility

For all refund requests where `Order.status` is not `PAID` or `DELIVERED`, response status = 422 with error `REFUND_NOT_ELIGIBLE`.

**Validates: Requirements 2.3**

### Property 9: Atomic Checkout Rollback

For all checkout transactions that fail after `Order` row creation but before all inventory updates complete, no `Order` row persists and no `inventory.reserved` is incremented.

**Validates: Requirements 15.2**

### Property 10: Low-Stock Dedup

For all products P, the Notification_Service creates at most one low-stock notification for P within any 24-hour window, regardless of how many checkout transactions trigger the threshold.

**Validates: Requirements 11.2**

---

## Error Handling

### Error Response Shape

All errors follow the existing pattern:
```json
{ "error": "ERROR_CODE", "detail": "human readable (dev only)" }
```

### Error Code Registry (new codes)

| Code | HTTP | Trigger |
|---|---|---|
| `REFUND_NOT_ELIGIBLE` | 422 | Refund attempted on non-eligible order |
| `COUPON_INVALID` | 400 | Coupon code not found or inactive |
| `COUPON_EXPIRED` | 400 | Coupon past `expiresAt` |
| `CHECKOUT_RATE_LIMITED` | 429 | Per-customer checkout rate limit exceeded |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `INVALID_STATUS_TRANSITION` | 422 | Order status transition not in allowed graph |
| `TRACKING_REQUIRED` | 400 | SHIPPED status set without trackingNumber + carrier |
| `INVALID_MEDIA` | 400 | File too large or wrong MIME type |
| `MEDIA_LIMIT_EXCEEDED` | 422 | Product already has 8 images |
| `OWNERSHIP_DENIED` | 403 | Artisan attempted action on another artisan's product |
| `STUDIO_NOT_APPROVED` | 200 | Artisan earnings/payout requested before studio approved |

### Webhook Error Handling

Invalid Stripe signature → 400 + insert row into `activity_logs` with action `WEBHOOK_SIGNATURE_FAILED`. All other webhook processing errors → 500 with Stripe retry (Stripe retries up to 3 days).

### SSE Error Handling

If the client disconnects mid-write, the `write()` call throws. This is caught per-connection and triggers cleanup (remove from pool, clear heartbeat). Upstream services never receive the error.

### Reconciliation Job Error Handling

Stale PENDING orders: if the Stripe API call fails for a given order, that order is skipped and retried on the next job run. Errors are logged to `activity_logs` with action `RECONCILIATION_ERROR`.

---

## Testing Strategy

### Unit Tests

- `coupon.service.ts` — property-based: generate random `percentOff` (1–100) and `originalTotalCents` values, assert `discountCents = floor(T × p / 100)`
- `recommendation engine scoring` — property-based: generate random signal sets, assert exclusion and stock filter properties hold for all outputs
- `inventory.service.ts` — assert atomicity by mocking DB transaction failures at each step

### Integration Tests

- Full checkout flow: POST checkout → mock Stripe webhook → assert Order PAID + inventory decremented
- Refund flow: POST refund → mock `charge.refunded` webhook → assert Order REFUNDED + inventory released
- Idempotency: POST same webhook twice → assert DB state identical after second call
- Coupon redemption: valid, invalid, and expired coupon codes at checkout

### Property-Based Tests (fast-check or similar)

Verify all 10 correctness properties defined above against the running service with generated inputs.

### End-to-End Tests

- CartDrawer → checkout → Stripe test mode payment → webhook → order PAID notification via SSE → customer notification bell updates
- Admin refund flow: AdminPage refund button → order REFUNDED → customer notification

### Security Tests

- Login rate limit: 21 rapid requests → 21st returns 429
- Account lockout: N+1 failed logins → 423 `ACCOUNT_LOCKED`
- Webhook without signature → 400, logged
- ARTISAN hitting admin endpoints → 403
- CUSTOMER hitting artisan-only studio earnings → 403
