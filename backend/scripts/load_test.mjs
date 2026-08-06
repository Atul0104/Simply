#!/usr/bin/env node
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const base = new URL(process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:8000');
const batches = (process.env.LOAD_TEST_BATCHES || '50,200,500,1000,1500,2000,5000').split(',').map(Number);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS || 15000);
const maxSockets = Number(process.env.LOAD_TEST_MAX_SOCKETS || 200);
const paths = (process.env.LOAD_TEST_PATHS || '/health,/api/products?page=1&page_size=12,/api/privacy/consent/config,/api/catalog/bestsellers?limit=8,/api/storefront/reviews/top?limit=10').split(',');
const agent = new http.Agent({ keepAlive: true, maxSockets, maxFreeSockets: maxSockets, timeout: timeoutMs });

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function request(path) {
  return new Promise(resolve => {
    const started = performance.now();
    const req = http.request({ hostname: base.hostname, port: base.port || 80, path, method: 'GET', agent, timeout: timeoutMs }, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, ms: performance.now() - started }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', error => resolve({ status: 0, ms: performance.now() - started, error: error.code || error.message }));
    req.end();
  });
}

async function runBatch(size) {
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: size }, (_, index) => request(paths[index % paths.length])));
  const seconds = (performance.now() - started) / 1000;
  const durations = results.map(item => item.ms).sort((a, b) => a - b);
  const failures = results.filter(item => item.status < 200 || item.status >= 400);
  const statuses = Object.fromEntries([...new Set(results.map(item => item.status))].sort((a, b) => a - b).map(status => [status, results.filter(item => item.status === status).length]));
  const errors = Object.fromEntries([...new Set(failures.map(item => item.error || String(item.status)))].map(error => [error, failures.filter(item => (item.error || String(item.status)) === error).length]));
  return { batch: size, duration_s: +seconds.toFixed(3), throughput_rps: +(size / seconds).toFixed(1), success_pct: +(((size - failures.length) / size) * 100).toFixed(2), p50_ms: +percentile(durations, .5).toFixed(1), p95_ms: +percentile(durations, .95).toFixed(1), p99_ms: +percentile(durations, .99).toFixed(1), max_ms: +percentile(durations, 1).toFixed(1), statuses, errors };
}

console.log(JSON.stringify({ target: base.origin, paths, timeout_ms: timeoutMs, max_sockets: maxSockets, started_at: new Date().toISOString() }));
for (const batch of batches) {
  const result = await runBatch(batch);
  console.log(JSON.stringify(result));
  await new Promise(resolve => setTimeout(resolve, 1000));
}
agent.destroy();
