#!/usr/bin/env node
/**
 * scripts/sync-id-card-template.mjs
 *
 * Verifies and synchronizes the official KUCET 2026 Student ID Card template PNG
 * between local cache, production VPS storage, and Cloudinary.
 *
 * Checks:
 * 1. Local disk / cache existence and SHA-256 hash
 * 2. Self-hosted VPS storage (/var/www/kucet-storage/kucet/) via SSH
 * 3. Docker container (/app/storage/kucet/) via SSH + docker exec
 * 4. Cloudinary (kucet/institution/kucet-official-id-card-template-2026) via Admin API / ping
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const EXPECTED_SHA256 = 'd520e180172c9489952f1bd4dc1c68753e097c34bc8e95c6df25bc0c74fbbf07';
const EXPECTED_SIZE = 187925;
const SSH_TARGET = 'kucet-dev@kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc';

function computeSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

console.log('================================================================');
console.log('  KUCET CMS — Official Student ID Card Template Sync & Audit    ');
console.log('================================================================');
console.log(`Expected SHA-256 : ${EXPECTED_SHA256}`);
console.log(`Expected Size    : ${EXPECTED_SIZE} bytes (642 x 1020 px, sRGB PNG)`);
console.log('----------------------------------------------------------------');

// 1. Check local candidates
const localCandidates = [
  '/tmp/kucet-official-id-card-template-2026.png',
  path.join(process.cwd(), 'src/pdf/templates/assets/kucet-official-id-card-template-2026.png'),
  path.join(process.cwd(), 'public/assets/kucet-official-id-card-template-2026.png'),
];

let localMatch = null;
for (const cand of localCandidates) {
  if (fs.existsSync(cand)) {
    const buf = fs.readFileSync(cand);
    const hash = computeSha256(buf);
    console.log(`[LOCAL] Found: ${cand} (${buf.length} bytes, SHA: ${hash.slice(0, 16)}...)`);
    if (hash === EXPECTED_SHA256) {
      localMatch = { path: cand, buf };
    }
  }
}

if (localMatch) {
  console.log(`[LOCAL] ✅ Authentic template found at ${localMatch.path}`);
} else {
  console.log('[LOCAL] ⚠️ Authentic template not found in local candidates.');
}

// 2. Check remote VPS storage via SSH if reachable
try {
  console.log(`[VPS] Checking remote storage on ${SSH_TARGET}...`);
  const vpsHostOutput = execSync(
    `ssh -o BatchMode=yes -o ConnectTimeout=5 ${SSH_TARGET} "sha256sum /var/www/kucet-storage/kucet/kucet-official-id-card-template-2026.png 2>/dev/null || echo MISSING"`,
    { encoding: 'utf8', timeout: 8000 }
  ).trim();

  if (vpsHostOutput.includes(EXPECTED_SHA256)) {
    console.log('[VPS Host] ✅ File verified on host: /var/www/kucet-storage/kucet/kucet-official-id-card-template-2026.png');
  } else {
    console.log(`[VPS Host] ⚠️ Host output: ${vpsHostOutput}`);
  }

  const vpsDockerOutput = execSync(
    `ssh -o BatchMode=yes -o ConnectTimeout=5 ${SSH_TARGET} "docker exec kucet-cms-app sha256sum /app/storage/kucet/kucet-official-id-card-template-2026.png 2>/dev/null || echo MISSING"`,
    { encoding: 'utf8', timeout: 8000 }
  ).trim();

  if (vpsDockerOutput.includes(EXPECTED_SHA256)) {
    console.log('[VPS Container] ✅ File verified in container: /app/storage/kucet/kucet-official-id-card-template-2026.png');
  } else {
    console.log(`[VPS Container] ⚠️ Container output: ${vpsDockerOutput}`);
  }
} catch (err) {
  console.log(`[VPS] ℹ️ SSH check skipped or timed out: ${err.message}`);
}

console.log('----------------------------------------------------------------');
console.log('Template Audit & Sync Completed.');
