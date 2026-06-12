# Aurum Atelier Production Architecture

## Product Scope

Aurum Atelier is a premium handcrafted marketplace with three isolated experiences behind one login page:

- Customer: product discovery, search, wishlist, cart, checkout, order tracking, reviews, saved collections, artisan following, and personalized recommendations.
- Artisan: profile management, product creation, premium media uploads, product edits, and inventory management only.
- Admin: total platform control across orders, users, seller approvals, moderation, payments, logistics, fraud, audit logs, analytics, and AI insights.

Admins and artisans are autonomous account types, not customer users with elevated flags. The login service authenticates an `AuthAccount`, then resolves exactly one profile: `Customer`, `Artisan`, or `AdminAccount`.

## Frontend Architecture

```txt
apps/web
  src/app
    layout.tsx
    page.tsx
    marketplace/[slug]/page.tsx
    artisan/dashboard/page.tsx
    admin/(protected)/page.tsx
  src/components
    design-system
    marketplace
    checkout
    artisan
    admin
    charts
  src/features
    auth
    products
    cart
    wishlist
    orders
    recommendations
  src/lib
    api-client.ts
    auth-session.ts
    rbac.ts
    analytics.ts
  src/styles
    tokens.css
```

The Vite implementation in `src/App.tsx` is an investor-demo version of this architecture. In production, the same account boundaries should be enforced by route groups, server components, API middleware, and server-side data loaders.

## Backend Architecture

```txt
apps/api
  src/main.ts
  src/config
  src/common
    guards
    filters
    interceptors
    decorators
  src/modules
    auth
    users
    artisans
    products
    inventory
    orders
    payments
    analytics
    notifications
    admin
    audit
    recommendations
  src/database
    prisma.service.ts
    repositories
  src/security
    rbac.ts
    jwt.strategy.ts
    refresh-token.service.ts
  src/jobs
    inventory-alerts.job.ts
    analytics-rollup.job.ts
    fraud-scan.job.ts
```

Recommended stack: NestJS or Express, PostgreSQL, Prisma, Redis, JWT access tokens, rotating refresh cookies, BullMQ workers, OpenTelemetry, and object storage with CDN image transformations.

## RBAC Matrix

| Permission | Customer Account | Artisan Account | Admin Account |
| --- | --- | --- | --- |
| products:read | yes | yes | yes |
| wishlist:write | yes | no | yes |
| cart:checkout | yes | no | yes |
| artisan:profile | no | yes | yes |
| inventory:write | no | yes | yes |
| media:write | no | yes | yes |
| orders:read | no | no | yes |
| analytics:read | no | no | yes |
| users:write | no | no | yes |
| security:read | no | no | yes |

Critical rule: artisans must never receive customer order details, buyer information, revenue analytics, platform statistics, other artisan data, or global sales data. Enforce this in UI routes, API guards, service methods, repository filters, database views/policies, and audit logs. Artisan and admin accounts use the same login page but receive completely separate JWT claims, session rows, service modules, and repository scopes.

## API Routes

```txt
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /me

GET    /products
GET    /products/:id
POST   /artisan/products
PATCH  /artisan/products/:id
PATCH  /artisan/products/:id/inventory
POST   /artisan/products/:id/media

POST   /wishlist/:productId
DELETE /wishlist/:productId
POST   /checkout/payment-intent
GET    /customer/orders
GET    /customer/orders/:id/tracking
POST   /products/:id/reviews

GET    /admin/analytics
GET    /admin/orders
PATCH  /admin/orders/:id/refund
GET    /admin/users
PATCH  /admin/accounts/:id/access
PATCH  /admin/artisans/:id/approval
GET    /admin/security/audit-logs
GET    /admin/security/fraud-alerts
GET    /admin/ai-insights
```

## Security Controls

- Password hashing with Argon2id or bcrypt cost tuned to the deployment target.
- JWT access tokens with short expiration and rotating refresh tokens stored in secure, httpOnly, sameSite cookies.
- Helmet headers, CORS allowlist, CSRF protection for cookie-authenticated mutations, input validation with Zod DTOs, request size limits, and API throttling.
- Prisma parameterized queries, strict repository methods, row ownership checks, and indexes for account kind, order status, product status, and event timestamps.
- Audit logging for authentication, payment, moderation, admin access changes, refund actions, seller approvals, suspicious activity, and permission denials.
- Webhook signature verification for payments and shipping carriers.
- Secrets managed by cloud secret stores, never committed to source control.

## DevOps

```txt
infra
  docker
    web.Dockerfile
    api.Dockerfile
  compose.yml
  github-actions
    ci.yml
    deploy-web.yml
    deploy-api.yml
  terraform
    postgres.tf
    redis.tf
    object-storage.tf
    observability.tf
```

Deployment target: Vercel for the frontend, AWS-compatible containers for the API, managed PostgreSQL, managed Redis, object storage CDN, and OpenTelemetry-compatible monitoring.

## Performance Strategy

- Server-render critical landing, product, and admin pages in production.
- Use image CDN resizing, modern formats, lazy loading, and blur placeholders.
- Split admin charts and heavy dashboards into separate chunks.
- Cache product discovery and recommendation feeds in Redis.
- Materialize analytics read models with scheduled workers.
- Use edge caching for public collections and artisan profiles.
- Keep animation transforms GPU-friendly: opacity, translate, scale, blur used sparingly.
