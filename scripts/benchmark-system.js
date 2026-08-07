import { HealthService } from '../src/services/shared/HealthService.js';
import { getRolePermissions } from '../src/lib/rbac.js';
import { cacheAside, CACHE_KEYS } from '../src/lib/cache.js';

async function runPerformanceBenchmarks() {
  console.info("=================================================");
  console.info("KUCET CMS — Operational Performance Benchmarking");
  console.info("=================================================\n");

  const results = [];

  // 1. Health Diagnostics Benchmark
  const startHealth = Date.now();
  const diag = await HealthService.getFullDiagnostics();
  const healthDuration = Date.now() - startHealth;
  results.push({ operation: 'System Health Diagnostics', durationMs: healthDuration, status: diag.status });

  // 2. RBAC Permission Resolution Benchmark
  const startRbac = Date.now();
  for (let i = 0; i < 1000; i++) {
    getRolePermissions('hod');
    getRolePermissions('admin');
  }
  const rbacDuration = Date.now() - startRbac;
  results.push({ operation: '1,000 RBAC Matrix Evaluations', durationMs: rbacDuration, status: 'healthy' });

  // 3. Cache-Aside Lookup Benchmark
  const startCache = Date.now();
  await cacheAside(CACHE_KEYS.COLLEGE_CONFIG, async () => ({ name: 'KUCET' }), { ttl: 60 });
  const cacheDuration = Date.now() - startCache;
  results.push({ operation: 'Cache-Aside Key Lookup', durationMs: cacheDuration, status: 'healthy' });

  console.info(JSON.stringify(results, null, 2));
  console.info("\n✅ Benchmark execution completed.");
}

runPerformanceBenchmarks().catch(console.error);
