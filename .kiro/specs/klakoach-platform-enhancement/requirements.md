# Requirements Document

## Introduction

This document specifies requirements for massively enhancing the Klakoach artisan marketplace platform. The existing codebase is a React + TypeScript (Vite) frontend backed by a Node.js/Express + better-sqlite3 + Prisma-defined schema server. It already has authentication, RBAC, a basic orders module, an admin router, an artisan studio router, AI endpoints, and a product catalog.

The enhancement scope covers four primary pillars:

1. **Payment Gateway Integration** — Full Stripe payment-intent / webhook lifecycle replacing the current PENDING-only checkout stub.
2. **Personalized Recommendations** — Server-side behavioural signals (browse history, purchase history, wishlist, category affinity) driving a recommendation feed; client-side browsing signals captured without requiring Google account access.
3. **God-level Backend Quality** — Real-time notifications via Server-Sent Events (SSE), robust API additions (shipping tracking, coupon redemption, refunds, artisan payout tracking), and hardened security.
4. **World-class Platform Features** — Artisan dashboard earnings view, admin financial reconciliation panel, platform analytics enhancements, order lifecycle emails via webhook triggers, and a complete customer account centre.

---

## Glossary

- **Payment_Service**: The server module that orchestrates Stripe payment-intent creation, confirmation, and webhook processing.
- **Recommendation_Engine**: The server service that scores and ranks products for a given customer based on stored behavioural signals.
- **Behaviour_Store**: The SQLite table (`browse_events`) that records per-customer product view, search, and click events used by the Recommendation_Engine.
- **SSE_Gateway**: The server endpoint (`/api/realtime/events`) that streams Server-Sent Events to authenticated clients.
- **Notification_Service**: The server service that writes rows to `notifications` and broadcasts them through the SSE_Gateway.
- **Artisan_Dashboard**: The `/studio` frontend page exposing revenue, orders, inventory, and payout data to ARTISAN-role users.
- **Admin_Panel**: The `/admin` frontend page exposing platform-wide analytics, reconciliation, fraud management, and settings to ADMIN-role users.
- **Order_Lifecycle**: The sequence of order statuses: PENDING → PAID → FULFILLING → SHIPPED → DELIVERED (or CANCELLED / REFUNDED).
- **Coupon_Service**: The server module that validates and applies percentage-off coupons at checkout.
- **Payout_Record**: A server-side record tracking artisan earnings per fulfilled order, used for reconciliation.
- **Stripe**: The external payment provider integrated via `stripe` npm package and Stripe webhooks.
- **Webhook_Handler**: The Express route that verifies and processes incoming Stripe webhook events.
- **Auth_Account**: The `auth_accounts` SQLite table row representing any authenticated identity (CUSTOMER, ARTISAN, or ADMIN).
- **Customer**: A user whose Auth_Account has `kind = CUSTOMER`.
- **Artisan**: A user whose Auth_Account has `kind = ARTISAN`.
- **Admin**: A user whose Auth_Account has `kind = ADMIN`.

---

## Requirements

### Requirement 1: Stripe Payment-Intent Checkout

**User Story:** As a Customer, I want to pay for my order using a credit or debit card via Stripe, so that my purchase is securely processed and my order status is updated in real time.

#### Acceptance Criteria

1. WHEN a Customer submits a checkout request with valid cart items, THE Payment_Service SHALL create a Stripe PaymentIntent and return a `clientSecret` and `orderId` to the client within 3 seconds.
2. WHEN the Stripe PaymentIntent reaches `payment_intent.succeeded` status, THE Webhook_Handler SHALL update the corresponding order status to `PAID` and decrement inventory `reserved` counts.
3. WHEN the Stripe PaymentIntent reaches `payment_intent.payment_failed` status, THE Webhook_Handler SHALL update the corresponding order status to `CANCELLED` and release all reserved inventory.
4. IF THE Webhook_Handler receives a request without a valid `Stripe-Signature` header, THEN THE Webhook_Handler SHALL reject the request with HTTP 400 and log the event to `activity_logs`.
5. THE Payment_Service SHALL store a `Payment` row with `provider = 'stripe'`, `providerPaymentId`, `status`, and `amountCents` for every PaymentIntent created.
6. WHEN a Customer completes payment, THE Notification_Service SHALL create a notification for the Customer with title "Payment Confirmed" and for each affected Artisan with title "New Paid Order".
7. WHERE the `guest_checkout_enabled` site setting is `true`, THE Payment_Service SHALL allow unauthenticated checkout by capturing an email address alongside the PaymentIntent.

### Requirement 2: Stripe Refund Processing

**User Story:** As an Admin, I want to initiate refunds for paid orders through the admin panel, so that Customer disputes are resolved without manual Stripe dashboard access.

#### Acceptance Criteria

1. WHEN an Admin submits a refund request for an order with status `PAID` or `DELIVERED`, THE Payment_Service SHALL call the Stripe Refunds API with the full `amountCents` and update the order status to `REFUNDED`.
2. WHEN Stripe confirms a refund via the `charge.refunded` webhook event, THE Webhook_Handler SHALL update the `Payment` row status to `REFUNDED` and release reserved inventory for that order.
3. IF THE Payment_Service receives a refund request for an order whose status is not `PAID` or `DELIVERED`, THEN THE Payment_Service SHALL return HTTP 422 with error code `REFUND_NOT_ELIGIBLE`; orders with status `PAID` are eligible for refund as specified in AC1.
4. THE Payment_Service SHALL log every refund action to `activity_logs` with action `ORDER_REFUNDED`, entity `orders`, and the Admin's `auth_account_id`.
5. WHEN a refund is processed, THE Notification_Service SHALL create a notification for the Customer with title "Refund Initiated" and body containing the refund amount.

### Requirement 3: Coupon Redemption at Checkout

**User Story:** As a Customer, I want to apply a coupon code at checkout to receive a discount, so that I can benefit from promotions.

#### Acceptance Criteria

1. WHEN a Customer provides a `couponCode` at checkout, THE Coupon_Service SHALL look up the coupon by code, verify it is `active` and not expired, and apply an exact discount calculated as `floor(originalTotal × percentOff / 100)` paise to the order total.
2. IF a Customer provides a coupon code that does not exist or is inactive, THEN THE Coupon_Service SHALL return HTTP 400 with error code `COUPON_INVALID`.
3. IF a Customer provides an expired coupon code, THEN THE Coupon_Service SHALL return HTTP 400 with error code `COUPON_EXPIRED`.
4. THE Coupon_Service SHALL record the applied coupon code and discount amount on the `orders` row by storing `coupon_code` and `discount_cents` fields.
5. THE Payment_Service SHALL create the Stripe PaymentIntent with the post-discount `amountCents` when a valid coupon is applied.

### Requirement 4: Behavioural Signal Capture

**User Story:** As a platform operator, I want to capture on-platform browsing and interaction signals for each Customer, so that the Recommendation_Engine can produce personalised results without relying on external browser data.

#### Acceptance Criteria

1. WHEN a Customer views a product detail page, THE Behaviour_Store SHALL record a `browse_events` row with `customer_id`, `product_id`, `event_type = 'VIEW'`, and `created_at`.
2. WHEN a Customer adds a product to their cart, THE Behaviour_Store SHALL record a `browse_events` row with `event_type = 'CART_ADD'`.
3. WHEN a Customer searches with a non-empty query, THE Behaviour_Store SHALL record a `browse_events` row with `event_type = 'SEARCH'` and the `query` text.
4. THE Behaviour_Store SHALL accept events from authenticated Customers only; unauthenticated event submissions SHALL be silently dropped without error.
5. THE Behaviour_Store SHALL retain at most 500 `browse_events` rows per Customer, discarding the oldest rows when the limit is exceeded.
6. FOR ALL event records stored in the Behaviour_Store, the `customer_id` SHALL reference a valid Customer row (referential integrity enforced at insert time).

### Requirement 5: Personalised Product Recommendations

**User Story:** As a Customer, I want to see product recommendations tailored to my browsing and purchase history, so that I discover relevant handcrafted items without manual filtering.

#### Acceptance Criteria

1. WHEN a Customer requests `GET /api/recommendations`, THE Recommendation_Engine SHALL return up to 12 active products ranked by a weighted relevance score derived from the Customer's category affinity, wishlist, recently viewed products, and purchase history.
2. WHEN a Customer has fewer than 5 recorded browse events, including brand new customers with zero browse events, THE Recommendation_Engine SHALL fall back to returning the 12 highest-rated active products.
3. THE Recommendation_Engine SHALL exclude products the Customer has already purchased from recommendation results.
4. THE Recommendation_Engine SHALL exclude out-of-stock products (available quantity = 0) from recommendation results.
5. WHEN a `productId` query parameter is provided, THE Recommendation_Engine SHALL return up to 8 products similar to the specified product based on shared category and price proximity within ±50%.
6. THE Recommendation_Engine SHALL respond within 500ms (inclusive) for any Customer with up to 500 stored browse events.
7. FOR ALL recommendation requests, the response payload SHALL conform to the existing `Product` type shape used by the frontend (`id`, `title`, `slug`, `price_cents`, `image_url`, `category`, `category_slug`, `artisan`, `stock`, `avg_rating`, `review_count`, `created_at`).

### Requirement 6: Real-time Notifications via SSE

**User Story:** As a logged-in user (Customer, Artisan, or Admin), I want to receive in-app notifications in real time without refreshing the page, so that I am immediately aware of order updates, approvals, and platform events.

#### Acceptance Criteria

1. WHEN an authenticated user connects to `GET /api/realtime/events`, THE SSE_Gateway SHALL establish a persistent SSE connection and stream `notification` events as they occur.
2. WHEN the Notification_Service creates a notification for a specific `auth_account_id`, THE SSE_Gateway SHALL push that notification to all active SSE connections for that account within 2 seconds.
3. WHEN an SSE client disconnects, THE SSE_Gateway SHALL clean up the connection handle and stop attempting to write to that client.
4. THE SSE_Gateway SHALL authenticate the SSE connection using the same Bearer token used by REST endpoints; authentication SHALL be checked after the connection handshake is established and the connection SHALL be closed with an error event if the token is invalid or absent.
5. THE SSE_Gateway SHALL send a heartbeat comment line (`: ping`) every 30 seconds to keep connections alive through proxies.
6. WHILE the SSE_Gateway has more than 500 concurrent connections, THE SSE_Gateway SHALL reject new connections with HTTP 503 and a `Retry-After: 5` header to prevent resource exhaustion; connections that pass authentication and other validation SHALL only be accepted when the concurrent connection count is below this limit.

### Requirement 7: Artisan Dashboard — Earnings and Payouts

**User Story:** As an Artisan, I want to see my total earnings, per-product revenue, payout status, and recent order activity in my studio dashboard, so that I can track the financial health of my business.

#### Acceptance Criteria

1. WHEN an Artisan requests `GET /api/studio/earnings`, THE Artisan_Dashboard SHALL return total lifetime revenue (sum of `price_cents × quantity` for all `PAID`, `FULFILLING`, `SHIPPED`, and `DELIVERED` orders containing the Artisan's products), per-product revenue, and a 30-day daily revenue series.
2. THE Artisan_Dashboard SHALL scope all revenue data exclusively to products owned by the requesting Artisan; cross-artisan data SHALL never appear in the response.
3. WHEN an Artisan requests `GET /api/studio/payouts`, THE Artisan_Dashboard SHALL return a list of `Payout_Record` rows associated with the Artisan, including `amount_cents`, `status` (`PENDING`, `PROCESSING`, `PAID`), and `period`.
4. THE Artisan_Dashboard SHALL not expose customer names, contact details, or delivery addresses in any artisan-accessible endpoint.
5. WHEN the Artisan's studio is not approved (`approved = 0`), THE Artisan_Dashboard SHALL return HTTP 200 with error code `STUDIO_NOT_APPROVED` in the response body for all earnings and payout endpoints.

### Requirement 8: Admin Financial Reconciliation Panel

**User Story:** As an Admin, I want a financial reconciliation view that shows gross merchandise value, payment gateway fees, artisan payouts due, and net platform revenue, so that I can manage platform finances accurately.

#### Acceptance Criteria

1. WHEN an Admin requests `GET /api/admin/financials`, THE Admin_Panel SHALL return: total GMV for all `PAID`/`FULFILLING`/`SHIPPED`/`DELIVERED` orders, total refund amount, estimated Stripe processing fees (2.9% + $0.30 per transaction), total artisan payouts disbursed, and net platform revenue.
2. THE Admin_Panel SHALL return a per-artisan breakdown showing studio name, total revenue, units sold, and payout status for the requested date range.
3. WHEN an Admin sets a payout for an artisan to `PROCESSING`, THE Admin_Panel SHALL update the `Payout_Record` status and log the action to `activity_logs` with action `PAYOUT_INITIATED`.
4. THE Admin_Panel SHALL allow filtering the financial summary by date range using ISO 8601 `from` and `to` query parameters; when neither is provided, the summary SHALL default to the last 30 days.
5. THE Admin_Panel SHALL enforce the `analytics:read` permission for all financial endpoints; requests from non-ADMIN accounts SHALL receive HTTP 403.

### Requirement 9: Enhanced Order Management

**User Story:** As an Admin, I want full order lifecycle management including status transitions, shipping information, and refund initiation, so that I can operate the marketplace without direct database access.

#### Acceptance Criteria

1. WHEN an Admin updates an order status to `SHIPPED`, THE Order management endpoint SHALL require a `trackingNumber` and `carrier` in the request body; if either is missing, THE endpoint SHALL return HTTP 400 with error code `TRACKING_REQUIRED`.
2. WHEN an order status is updated to `SHIPPED`, THE Notification_Service SHALL create a notification for the Customer with title "Your order has shipped" and body containing the carrier name and tracking number.
3. WHEN an Admin requests `GET /api/admin/orders/:id`, THE Admin_Panel SHALL return full order detail including customer name, items, payment record, shipping record, and fraud score.
4. THE Admin_Panel SHALL support bulk status updates for up to 50 orders in a single `PATCH /api/admin/orders/bulk` request; each order in the batch SHALL be validated individually and failures SHALL be reported per order without aborting the entire batch.
5. IF an Admin attempts to transition an order to a status that is not a valid next step in the Order_Lifecycle (e.g., `DELIVERED` → `PAID`), THEN THE endpoint SHALL return HTTP 422 with error code `INVALID_STATUS_TRANSITION`.

### Requirement 10: Customer Account Centre

**User Story:** As a Customer, I want a dedicated account page where I can view my order history, manage saved addresses, update my profile name, and see my wishlist, so that I can manage my marketplace activity in one place.

#### Acceptance Criteria

1. WHEN a Customer requests `GET /api/customer/profile`, THE Customer_Profile endpoint SHALL return the customer's `name`, `email`, list of saved `Address` rows, and aggregate order count.
2. WHEN a Customer submits `PATCH /api/customer/profile` with a valid `name` field, THE Customer_Profile endpoint SHALL update the customer's name and return HTTP 200.
3. WHEN a Customer submits `POST /api/customer/addresses` with `line1`, `city`, `country`, and `postal`, THE Address endpoint SHALL create and return the new Address row; THE endpoint SHALL return HTTP 400 immediately when any required field is missing, preventing address creation.
4. IF a Customer submits an address with a missing required field, THEN THE Address endpoint SHALL return HTTP 400 with error code `VALIDATION_ERROR`.
5. THE Customer_Profile endpoint SHALL enforce the `cart:checkout` permission (CUSTOMER role); ARTISAN and ADMIN accounts SHALL receive HTTP 403.
6. WHEN a Customer requests `GET /api/customer/orders`, THE endpoint SHALL return the Customer's full order history including status, total, item count, and payment status.

### Requirement 11: Artisan Inventory Alerts

**User Story:** As an Artisan, I want to receive automatic notifications when any of my products reaches low-stock threshold, so that I can restock before items sell out.

#### Acceptance Criteria

1. WHEN a product's available inventory (`quantity - reserved`) drops to or below the `low_stock_at` threshold after a checkout transaction, THE Notification_Service SHALL create a notification for the product's Artisan with title "Low Stock Alert" and body identifying the product title and remaining quantity.
2. THE Notification_Service SHALL not send duplicate low-stock notifications for the same product within a 24-hour window.
3. WHEN an Artisan restores a product's inventory above the `low_stock_at` threshold via `PATCH /api/products/:id` (stock update), THE Notification_Service SHALL suppress further low-stock alerts for that product until the threshold is crossed again.
4. THE Notification_Service SHALL deliver low-stock alerts to active SSE connections for the Artisan within 5 seconds of the triggering checkout transaction.

### Requirement 12: Platform-wide Search Improvements

**User Story:** As a Customer, I want a fast, typo-tolerant search experience that returns ranked results and supports filtering by price range, category, rating, and stock availability, so that I can find the right handcrafted item quickly.

#### Acceptance Criteria

1. WHEN a Customer submits a search query, THE Search endpoint SHALL rank results by full-text relevance (title and description match), average rating, and stock availability, with configurable sort overrides.
2. WHEN a Customer submits a search query with `minPrice` and `maxPrice` parameters where either value is greater than zero, THE Search endpoint SHALL return only products within that price range (inclusive), with prices expressed in paise (smallest currency unit); zero values for either parameter SHALL be treated as "no filter specified".
3. WHEN a Customer submits a search query with `minRating` parameter (value between 1 and 5), THE Search endpoint SHALL return only products with `avg_rating` ≥ `minRating`.
4. THE Search endpoint SHALL support pagination via `page` and `limit` parameters, with `limit` capped at 48 per page.
5. WHEN the search query is empty and no filters are applied, THE Search endpoint SHALL return the most recently added active products, sorted by `created_at DESC`.

### Requirement 13: Security Hardening

**User Story:** As a platform operator, I want the API to enforce rate limiting on sensitive operations, CSRF protection on cookie-authenticated mutations, and IP-based suspicious activity detection, so that the platform is resistant to abuse.

#### Acceptance Criteria

1. THE Auth_Account login endpoint SHALL enforce a per-IP rate limit of 20 requests per 15-minute window, allowing exactly 20 requests and blocking the 21st; after limit exhaustion, THE endpoint SHALL return HTTP 429 with a `Retry-After` header.
2. WHEN the `max_login_attempts` site setting is set (integer ≥ 1), THE login endpoint SHALL temporarily lock an Auth_Account after that many consecutive failed attempts for the same email within 15 minutes, returning HTTP 423 with error code `ACCOUNT_LOCKED`.
3. THE Payment_Service checkout endpoint SHALL enforce a per-Customer rate limit of 10 requests per 10-minute window to prevent checkout flooding.
4. WHEN an Admin account has not been active (no `activity_logs` entry with action `LOGIN`) for 30 consecutive days, THE Admin_Panel SHALL flag the account in `GET /api/admin/security/inactive-admins` for review.
5. THE Webhook_Handler SHALL validate every inbound Stripe webhook using `stripe.webhooks.constructEvent` with the `STRIPE_WEBHOOK_SECRET` environment variable; unsigned requests SHALL be rejected with HTTP 400.

### Requirement 14: Artisan Media Upload

**User Story:** As an Artisan, I want to upload multiple images for each product directly from my dashboard, so that my listings have rich visual content without requiring external hosting.

#### Acceptance Criteria

1. WHEN an Artisan submits a `POST /api/studio/products/:id/media` request with an image file up to 5 MB in JPEG, PNG, or WebP format, THE Media endpoint SHALL store the file and create a `ProductMedia` row with the file URL, alt text, and sort order.
2. IF an Artisan submits a file larger than 5 MB or in an unsupported format, THEN THE Media endpoint SHALL return HTTP 400 with error code `INVALID_MEDIA`.
3. THE Media endpoint SHALL enforce artisan ownership: only the Artisan who owns the product MAY upload media; ADMIN accounts are also permitted.
4. WHEN an Artisan deletes a media item via `DELETE /api/studio/products/:id/media/:mediaId`, THE Media endpoint SHALL remove the `ProductMedia` row and return HTTP 200.
5. THE Media endpoint SHALL allow a maximum of 8 images per product; requests that would exceed this limit SHALL be rejected with HTTP 422 and error code `MEDIA_LIMIT_EXCEEDED`.

### Requirement 15: End-to-end Data Integrity — Payment and Order Round Trip

**User Story:** As a platform operator, I want the payment and order system to maintain consistent state across all transitions, so that no order is left in an inconsistent state after a crash or duplicate webhook delivery.

#### Acceptance Criteria

1. FOR ALL `payment_intent.succeeded` webhook events with the same `providerPaymentId`, THE Webhook_Handler SHALL process the event exactly once (idempotent); duplicate deliveries SHALL be acknowledged with HTTP 200 without reprocessing.
2. WHEN a checkout transaction creates an order and reserves inventory, the order creation and inventory reservation SHALL be executed in a single atomic database transaction; a failure in either step SHALL roll back both.
3. FOR ALL order status transitions that release inventory (CANCELLED, REFUNDED), the status update and inventory release SHALL be executed atomically.
4. THE Payment_Service SHALL store the Stripe `providerPaymentId` with a UNIQUE constraint so that duplicate PaymentIntents cannot be recorded for the same payment.
5. WHEN the server restarts while orders are in `PENDING` status for more than 30 minutes, a reconciliation job SHALL check PaymentIntent status via the Stripe API and update orders accordingly.
