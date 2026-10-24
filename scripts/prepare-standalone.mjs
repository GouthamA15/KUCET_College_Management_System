import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  const staticSrc = path.join(projectRoot, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.info('[standalone] Successfully copied .next/static to .next/standalone/.next/static');
  }

  const publicSrc = path.join(projectRoot, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.info('[standalone] Successfully copied public to .next/standalone/public');
  }
} else {
  console.info('[standalone] No .next/standalone directory found. Skipping asset copy.');
}
