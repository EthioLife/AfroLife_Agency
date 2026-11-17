import assert from 'node:assert/strict';

const baseUrl = process.env.AFROLIFE_LOAD_BASE_URL ?? 'http://127.0.0.1:3010';
const concurrency = Number(process.env.AFROLIFE_LOAD_CONCURRENCY ?? 25);
const requests = Number(process.env.AFROLIFE_LOAD_REQUESTS ?? 500);
const paths = (process.env.AFROLIFE_LOAD_PATHS ?? '/healthz')
  .split(',').map((path) => path.trim()).filter(Boolean);
const token = process.env.AFROLIFE_LOAD_TOKEN;

const base = new URL(baseUrl);
assert.ok(['http:', 'https:'].includes(base.protocol), 'Load target must use HTTP or HTTPS');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(base.hostname),
  'Load smoke is restricted to loopback; use an approved staging load-test plan for remote systems');
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 50,
  'AFROLIFE_LOAD_CONCURRENCY must be an integer from 1 to 50');
assert.ok(Number.isInteger(requests) && requests >= 1 && requests <= 2000,
  'AFROLIFE_LOAD_REQUESTS must be an integer from 1 to 2000');
assert.ok(paths.length > 0 && paths.every((path) => path.startsWith('/') && !path.startsWith('//')),
  'AFROLIFE_LOAD_PATHS must contain comma-separated absolute paths');

const samples = [];
const failures = [];
let cursor = 0;
const startedAt = performance.now();

async function worker() {
  while (cursor < requests) {
    const index = cursor++;
    const path = paths[index % paths.length];
    const url = new URL(path, base);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
      const elapsedMs = performance.now() - started;
      await response.arrayBuffer();
      samples.push({ elapsedMs, status: response.status });
      if (!response.ok) failures.push({ index, path, status: response.status });
    } catch (error) {
      samples.push({ elapsedMs: performance.now() - started, status: 0 });
      failures.push({ index, path, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));

const durations = samples.map((sample) => sample.elapsedMs).sort((a, b) => a - b);
const percentile = (p) => durations[Math.max(0, Math.ceil(durations.length * p) - 1)] ?? 0;
const result = {
  target: `${base.origin}${paths.length === 1 ? paths[0] : ` (${paths.length} paths)`}`,
  count: samples.length,
  concurrency: Math.min(concurrency, requests),
  elapsed_seconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
  status_counts: Object.fromEntries([...new Set(samples.map((sample) => sample.status))]
    .sort().map((status) => [status, samples.filter((sample) => sample.status === status).length])),
  latency_ms: {
    p50: Number(percentile(0.50).toFixed(1)),
    p95: Number(percentile(0.95).toFixed(1)),
    p99: Number(percentile(0.99).toFixed(1)),
    max: Number((durations.at(-1) ?? 0).toFixed(1)),
  },
  failed_requests: failures.length,
  failures: failures.slice(0, 20),
  note: 'Local smoke evidence only. It is not a representative capacity, endurance, spike, or production SLO test.',
};
console.log(JSON.stringify(result, null, 2));

if (failures.length) process.exitCode = 1;
