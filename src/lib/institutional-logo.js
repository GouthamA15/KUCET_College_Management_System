import fs from 'fs';
import path from 'path';

const PUBLIC_ASSETS_ROOT = path.resolve(process.cwd(), 'public', 'assets');
const PRIMARY_LOGO_FILE = 'ku-college-logo.png';
const FALLBACK_LOGO_FILE = 'ku-logo.png';
const ALLOWLISTED_LOGO_FILES = new Set([PRIMARY_LOGO_FILE, FALLBACK_LOGO_FILE]);

let cachedLogoBuffer = null;
let cachedLogoDataUrl = null;

function isInsideAllowlistedAssetsDir(candidatePath, filename) {
  if (!ALLOWLISTED_LOGO_FILES.has(filename)) return false;
  const resolved = path.resolve(candidatePath);
  return resolved === path.join(PUBLIC_ASSETS_ROOT, filename) &&
    resolved.startsWith(`${PUBLIC_ASSETS_ROOT}${path.sep}`);
}

/**
 * Loads the institutional college logo PNG buffer from `public/assets/`.
 * Uses explicit allowlisted paths under `public/assets` so Next.js/Turbopack
 * traces only the known logo assets instead of the entire workspace.
 *
 * @returns {Buffer|null} PNG buffer if found, otherwise null
 */
export function getInstitutionalLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;

  const primaryPath = path.join(process.cwd(), 'public', 'assets', 'ku-college-logo.png');
  if (isInsideAllowlistedAssetsDir(primaryPath, PRIMARY_LOGO_FILE) && fs.existsSync(primaryPath)) {
    cachedLogoBuffer = fs.readFileSync(primaryPath);
    return cachedLogoBuffer;
  }

  const fallbackPath = path.join(process.cwd(), 'public', 'assets', 'ku-logo.png');
  if (isInsideAllowlistedAssetsDir(fallbackPath, FALLBACK_LOGO_FILE) && fs.existsSync(fallbackPath)) {
    cachedLogoBuffer = fs.readFileSync(fallbackPath);
    return cachedLogoBuffer;
  }

  return null;
}

/**
 * Returns the institutional college logo encoded as a PNG data URL.
 *
 * @returns {string|null} Base64 PNG data URL if found, otherwise null
 */
export function getInstitutionalLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  const logoBuf = getInstitutionalLogoBuffer();
  if (!logoBuf) return null;

  cachedLogoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
  return cachedLogoDataUrl;
}
