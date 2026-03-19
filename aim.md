# API Gateway — Production Aim

## What We're Building

A production-grade API Gateway in Node.js that sits in front of all microservices.
It handles cross-cutting concerns — auth, rate limiting, routing, observability —
so individual services don't have to.

---

## Current State (Starter)

| Feature | Status |
|---|---|
| JWT authentication | Done |
| In-memory rate limiter | Done |
| HTTP proxy + routing | Done |
| Request logger | Done |
| Error handler | Done |
| Config validation (Zod) | Done |
| Structured logging (pino) | Done |
| Redis client singleton | Done |
| Circuit breaker (opossum) | Done |

---

## Production Target

### 1. Security
- [ ] **Helmet** — sets secure HTTP headers (HSTS, CSP, X-Frame-Options, etc.)
- [ ] **CORS** — configurable allowed origins per route
- [ ] **Request size limits** — reject oversized payloads before they hit upstreams
- [ ] **JWT refresh token flow** — access token + refresh token, rotation on use
- [ ] **Role-based access control (RBAC)** — per-route role checks from JWT claims
- [ ] **IP allowlist/blocklist** — configurable at startup via env or Redis set

### 2. Rate Limiting (Redis-backed)
- [ ] **Sliding window algorithm** in Redis using sorted sets — accurate under concurrency
- [ ] **Per-user and per-IP** limits — authenticated users get higher quotas
- [ ] **Per-route overrides** — e.g. `/api/auth/login` has stricter limits than `/api/products`
- [ ] **Standard headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] **Graceful Redis fallback** — if Redis is down, fail open with in-memory limiter

### 3. Circuit Breaker (per upstream)
- [ ] **Opossum circuit breaker** wrapping each upstream target
- [ ] **Three states** — Closed (normal), Open (failing fast), Half-Open (probing recovery)
- [ ] **Configurable thresholds** — error %, volume threshold, timeout, reset timeout via env
- [ ] **Fallback responses** — return cached response or 503 with `Retry-After` header
- [ ] **Metrics emission** — fire events on state change for observability

### 4. Observability
- [ ] **Structured JSON logs** via pino — every request logged with method, path, status, latency, user id
- [ ] **Correlation ID** — generate `X-Request-Id` per request, propagate to upstreams, log it
- [ ] **Health check endpoint** `GET /health` — checks Redis connectivity and upstream reachability
- [ ] **Metrics endpoint** `GET /metrics` — exposes request counts, error rates, circuit breaker states
- [ ] **Log redaction** — strip `Authorization`, `Cookie`, passwords from logs automatically

### 5. Reliability
- [ ] **Graceful shutdown** — on `SIGTERM`, stop accepting new requests, drain in-flight, close Redis
- [ ] **Retry with backoff** — configurable retries on upstream 5xx before tripping circuit breaker
- [ ] **Timeout per upstream** — hard deadline on proxy calls, kills hanging requests
- [ ] **Keep-alive tuning** — reuse upstream connections, avoid TCP overhead per request

### 6. Routing
- [ ] **Route registry** — single source of truth in `routes.config.js`, no logic scattered around
- [ ] **Path rewriting** — strip gateway prefix before forwarding (e.g. `/api/users/123` → `/123`)
- [ ] **Header injection** — forward `X-Request-Id`, `X-User-Id`, `X-User-Role` to upstreams
- [ ] **Websocket proxying** — upgrade HTTP connections for services that need it

### 7. Configuration
- [ ] **Zod schema validation** — gateway crashes at startup with clear errors if env is misconfigured
- [ ] **Per-environment configs** — `.env.development`, `.env.production`, `.env.test`
- [ ] **Hot-reloadable route config** — update routes without restarting (via Redis pub/sub or config watch)

### 8. Testing
- [ ] **Unit tests** — auth middleware, rate limiter logic, config validation
- [ ] **Integration tests** — supertest against a running gateway with mocked upstreams
- [ ] **Load test** — k6 or autocannon script to verify rate limiting holds under concurrency
- [ ] **Circuit breaker test** — simulate upstream failure and assert breaker opens correctly

### 9. Deployment
- [ ] **Dockerfile** — multi-stage build, non-root user, minimal final image
- [ ] **docker-compose.yml** — gateway + Redis + mock upstream services for local dev
- [ ] **`.dockerignore`** — exclude node_modules, .env, test files from image
- [ ] **Process manager** — PM2 config or rely on container restart policy
- [ ] **Kubernetes-ready** — liveness probe (`/health`), readiness probe, resource limits in YAML

---

## Architecture Diagram

```
Client Request
      │
      ▼
┌─────────────────────────────────────────┐
│              API Gateway                │
│                                         │
│  requestLogger → rateLimiter → auth     │
│       │               │                 │
│       │           Redis (sorted set)    │
│       ▼                                 │
│    router                               │
│       │                                 │
│  ┌────┴──────────────────────┐          │
│  │  CircuitBreaker (opossum) │          │
│  └────┬──────────────────────┘          │
└───────┼─────────────────────────────────┘
        │
   ┌────┴──────────────────┐
   │     Upstream Services  │
   │  users │ products │ …  │
   └───────────────────────┘
```

---

## Why Each Decision Matters (Interview Talking Points)

**Why Redis for rate limiting, not in-memory?**
In-memory state is per-process. With multiple gateway instances behind a load balancer,
each instance would have its own counter — a user could send N×instances requests before
being throttled. Redis gives a single shared counter across all instances.

**Why sliding window, not fixed window?**
Fixed window has a boundary exploit: a user can send max requests at 11:59 and again at
12:00, doubling the allowed rate at the boundary. Sliding window tracks timestamps in a
sorted set and counts only requests within the last N seconds from *now*, eliminating
the boundary spike.

**Why circuit breaker?**
Without it, a failing upstream causes requests to pile up waiting for timeouts. That
exhausts the thread/event loop and takes down the gateway too. The circuit breaker
fails fast after a threshold is crossed, shedding load and giving the upstream time
to recover.

**Why Zod config validation at startup?**
Misconfigured env vars (wrong Redis URL, short JWT secret) cause silent runtime failures
at 3am. Validating and crashing loudly at startup means bad config is caught at deploy
time, not in production under load.

**Why pino over console.log / winston?**
Pino is 5–10× faster than winston because it does minimal work on the hot path and
defers serialization. In a high-throughput gateway, logging is on every request —
logger performance directly affects p99 latency.

---

## Definition of Done

The gateway is production-level when:
1. It handles 10k req/s on a single instance without degrading
2. A Redis outage does not take the gateway down
3. An upstream going down trips the circuit breaker and returns fast 503s
4. All secrets are validated at startup — no silent misconfigs
5. Every request produces a structured log with a correlation ID
6. The full test suite passes including load tests
7. It ships as a Docker image with health and readiness probes