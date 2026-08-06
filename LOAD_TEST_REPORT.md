# Load and stress test report

Date: 2026-08-06  
Target: local Windows preview (`127.0.0.1`), FastAPI/Uvicorn single process with mock MongoDB; React development server.  
Harness: `backend/scripts/load_test.mjs`, Node HTTP keep-alive, 15-second active-socket timeout, 200-socket controlled pool. Each API batch evenly mixed health, catalogue, consent configuration, bestsellers and top-review reads. Results do **not** represent production infrastructure.

## Controlled API load

| Requests | Success | Throughput | p50 | p95 | p99 | Maximum |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 100% | 126.1 rps | 338 ms | 383 ms | 383 ms | 383 ms |
| 200 | 100% | 142.8 rps | 701 ms | 1.31 s | 1.36 s | 1.36 s |
| 500 | 100% | 175.3 rps | 2.20 s | 2.80 s | 2.81 s | 2.81 s |
| 1,000 | 100% | 181.7 rps | 3.07 s | 5.44 s | 5.45 s | 5.45 s |
| 1,500 | 100% | 150.8 rps | 5.41 s | 9.86 s | 9.89 s | 9.90 s |
| 2,000 | 100% | 160.9 rps | 5.96 s | 12.27 s | 12.32 s | 12.33 s |
| 5,000 | 100% | 155.4 rps | 16.91 s | 30.79 s | 31.98 s | 32.01 s |

Interpretation: correctness/availability passed the controlled batches, but latency failed beyond light load. This preview saturates at approximately 150–180 mixed read requests/second and queues excess work. A practical provisional user-facing target of p95 < 1 second is met only below the tested 200-request burst.

## Frontend document load

| Requests | Success | Throughput | p50 | p95 | p99 | Maximum |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 100% | 132.5 rps | 303 ms | 357 ms | 357 ms | 357 ms |
| 200 | 100% | 389.9 rps | 279 ms | 460 ms | 464 ms | 465 ms |
| 500 | 100% | 746.1 rps | 422 ms | 609 ms | 624 ms | 630 ms |
| 1,000 | 100% | 1,019.6 rps | 404 ms | 904 ms | 920 ms | 923 ms |
| 1,500 | 100% | 641.5 rps | 1.66 s | 2.25 s | 2.27 s | 2.28 s |
| 2,000 | 100% | 1,059.4 rps | 1.17 s | 1.77 s | 1.81 s | 1.82 s |
| 5,000 | 100% | 1,517.0 rps | 1.68 s | 2.98 s | 3.09 s | 3.12 s |

The development server returned every request. Production static assets must be tested behind the actual CDN/edge cache; the local development server is not a deployment benchmark.

## Raw connection stress

An initial unbounded-socket run intentionally opened each batch simultaneously. At 50 and 200 it produced 120.5/120.8 rps, but from 500 onward Windows/Uvicorn began refusing new local TCP connections. At 5,000, 4,287 connections were refused. The API process recovered and remained healthy. This identifies the single-process/local-listener connection boundary, not application correctness. Use bounded ingress queues, multiple workers/replicas, connection limits and load shedding in production.

## Release decision and required next run

Performance status: **fails production latency qualification**. Before launch:

1. Run the same scenarios against production-like staging with authenticated MongoDB replica set, Nginx/load balancer, intended worker/replica counts and realistic network latency.
2. Add endpoint-specific scenarios for search, login/refresh, cart quote, inventory reservation, idempotent checkout, admin lists and signed webhooks. Use isolated seeded accounts; never run write stress against production.
3. Define SLOs (recommended starting point: p95 < 750 ms reads, p95 < 1.5 s checkout API, error rate < 1%) and expected concurrent-user/rps model.
4. Profile slow catalogue/review queries, verify indexes, cache safe public reads, paginate all lists and eliminate N+1 queries.
5. Configure multiple Uvicorn workers/containers based on CPU, database pool limits and measured scaling; apply ingress rate/concurrency limits and 429/503 load shedding.
6. Run soak (30–60 minutes), spike, breakpoint and recovery tests while monitoring CPU, memory, event-loop lag, MongoDB latency/connections, queue depth and error rate.

## Reproduction

```powershell
# API mixed-read batches
$env:LOAD_TEST_MAX_SOCKETS='200'
node backend/scripts/load_test.mjs

# Frontend document batches
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:3000'
$env:LOAD_TEST_PATHS='/'
$env:LOAD_TEST_MAX_SOCKETS='200'
node backend/scripts/load_test.mjs
```

Only run against systems you own or are explicitly authorized to test. The default target is localhost.
