#!/usr/bin/env node
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const base = new URL(process.env.STRESS_TEST_BASE_URL || 'http://127.0.0.1:8000');
const paths = (process.env.STRESS_TEST_PATHS || '/api/products?page=1&page_size=12,/api/privacy/consent/config,/api/catalog/bestsellers?limit=8,/api/storefront/reviews/top?limit=10').split(',');
const stages = (process.env.STRESS_TEST_STAGES || '50:10,200:10,500:10').split(',').map(stage => {
  const [concurrency, seconds] = stage.split(':').map(Number);
  return { concurrency, seconds };
});
const timeout = Number(process.env.STRESS_TEST_TIMEOUT_MS || 10000);

function request(agent, path) {
  return new Promise(resolve => {
    const started = performance.now();
    const req = http.request({ hostname: base.hostname, port: base.port || 80, path, agent, timeout }, response => {
      response.resume(); response.on('end', () => resolve({ status: response.statusCode, ms: performance.now() - started }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', error => resolve({ status: 0, ms: performance.now() - started, error: error.code || error.message }));
    req.end();
  });
}

for (const stage of stages) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: stage.concurrency, maxFreeSockets: stage.concurrency });
  const deadline = performance.now() + stage.seconds * 1000;
  const results = [];
  let sequence = 0;
  async function worker() {
    while (performance.now() < deadline) results.push(await request(agent, paths[sequence++ % paths.length]));
  }
  await Promise.all(Array.from({ length: stage.concurrency }, worker));
  agent.destroy();
  const durations = results.map(result => result.ms).sort((a, b) => a - b);
  const failures = results.filter(result => result.status < 200 || result.status >= 400);
  const percentile = value => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)] || 0;
  console.log(JSON.stringify({ concurrency: stage.concurrency, target_seconds: stage.seconds, requests: results.length, rps: +(results.length / stage.seconds).toFixed(1), success_pct: +((results.length - failures.length) / results.length * 100).toFixed(2), p50_ms: +percentile(.5).toFixed(1), p95_ms: +percentile(.95).toFixed(1), p99_ms: +percentile(.99).toFixed(1), overload_503: failures.filter(result => result.status === 503).length, transport_errors: failures.filter(result => result.status === 0).length }));
}
