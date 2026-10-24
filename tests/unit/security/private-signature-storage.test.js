import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { InstitutionAssetService, INSTITUTION_ASSET_REGISTRY } from '@/services/institution/InstitutionAssetService';
import { isPrivateInstitutionalAsset } from '@/lib/institution-assets';
import { getAssetUrl } from '@/lib/assets';
import { GET as assetViewGet } from '@/app/api/assets/view/[...path]/route';

describe('Security: Private Principal Signature & Institutional Asset Isolation', () => {
  const repoPublic = path.join(process.cwd(), 'public');

  describe('1. Static File Tree Invariant', () => {
    it('MUST NEVER contain principal signature files in the public directory', () => {
      const publicAssets = path.join(repoPublic, 'assets');
      const publicSig1 = path.join(publicAssets, 'principal-sign.png');
      const publicSig2 = path.join(publicAssets, 'principal-signStamp.png');
      const publicSig3 = path.join(publicAssets, 'principal-sign-black.png');
      const rootSig = path.join(repoPublic, 'principal-sign.png');

      expect(fs.existsSync(publicSig1)).toBe(false);
      expect(fs.existsSync(publicSig2)).toBe(false);
      expect(fs.existsSync(publicSig3)).toBe(false);
      expect(fs.existsSync(rootSig)).toBe(false);
    });

    it('.gitignore must contain rules preventing accidental signature commits', () => {
      const gitignoreContent = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
      expect(gitignoreContent).toContain('principal-sign');
    });
  });

  describe('2. Private Asset Metadata & Identification', () => {
    it('should flag all principal signature entries as isPrivate in registry', () => {
      const sig = INSTITUTION_ASSET_REGISTRY['principal/signature'];
      const stamp = INSTITUTION_ASSET_REGISTRY['principal/signature-stamp'];
      const black = INSTITUTION_ASSET_REGISTRY['principal/signature-black'];
      const v3 = INSTITUTION_ASSET_REGISTRY['principal/signature-v3'];
      const v4 = INSTITUTION_ASSET_REGISTRY['principal/signature-v4'];

      expect(sig.isPrivate).toBe(true);
      expect(stamp.isPrivate).toBe(true);
      expect(black.isPrivate).toBe(true);
      expect(v3.isPrivate).toBe(true);
      expect(v4.isPrivate).toBe(true);
    });

    it('isPrivateInstitutionalAsset must return true for any signature key or filename', () => {
      expect(isPrivateInstitutionalAsset('principal/signature')).toBe(true);
      expect(isPrivateInstitutionalAsset('principal/signature-stamp')).toBe(true);
      expect(isPrivateInstitutionalAsset('principal-sign.png')).toBe(true);
      expect(isPrivateInstitutionalAsset('principal-signStamp.png')).toBe(true);
      expect(isPrivateInstitutionalAsset('kucet/institution/private/principal-sign.png')).toBe(true);
      expect(isPrivateInstitutionalAsset('/assets/principal-sign.png')).toBe(true);
    });

    it('isPrivateInstitutionalAsset must return false for public branding assets', () => {
      expect(isPrivateInstitutionalAsset('institution/seal')).toBe(false);
      expect(isPrivateInstitutionalAsset('ku-college-seal.png')).toBe(false);
      expect(isPrivateInstitutionalAsset('institution/logo')).toBe(false);
      expect(isPrivateInstitutionalAsset('ku-logo.png')).toBe(false);
    });
  });

  describe('3. Public URL Prevention', () => {
    it('InstitutionAssetService.getAssetUrl MUST return empty string for private signatures', () => {
      expect(InstitutionAssetService.getAssetUrl('principal/signature')).toBe('');
      expect(InstitutionAssetService.getAssetUrl('principal-sign.png')).toBe('');
      expect(InstitutionAssetService.getAssetUrl('principal/signature-stamp')).toBe('');
    });

    it('getAssetUrl helper MUST return empty string for private signatures', () => {
      expect(getAssetUrl('principal/signature')).toBe('');
      expect(getAssetUrl('principal-sign.png')).toBe('');
      expect(getAssetUrl('kucet/institution/private/principal-sign.png')).toBe('');
      expect(getAssetUrl('/assets/principal-sign.png')).toBe('');
    });

    it('getAssetUrl helper should continue working normally for public assets', () => {
      const sealUrl = getAssetUrl('institution/seal');
      expect(sealUrl).toBeTruthy();
      expect(sealUrl).toContain('ku-college-seal.png');
    });
  });

  describe('4. Direct Asset View API Hard Block (/api/assets/view)', () => {
    it('should return 403 Forbidden for any direct request to principal-sign.png', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/assets/view/principal-sign.png',
        headers: new Headers(),
      };
      const response = await assetViewGet(mockReq, {
        params: Promise.resolve({ path: ['principal-sign.png'] }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should return 403 Forbidden for any request containing "private" in path', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/assets/view/kucet/institution/private/principal-sign.png',
        headers: new Headers(),
      };
      const response = await assetViewGet(mockReq, {
        params: Promise.resolve({ path: ['kucet', 'institution', 'private', 'principal-sign.png'] }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toContain('Forbidden');
    });
  });

  describe('5. Server-Side Private Retrieval for Document Generation', () => {
    it('InstitutionAssetService.getAssetBuffer checks private storage paths without public fallbacks', async () => {
      // Mock fs.existsSync & fs.promises.readFile to simulate private VPS storage hit
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return typeof p === 'string' && p.includes('institution/private') && p.includes('principal-sign.png');
      });
      const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true, size: 1024 });
      const readSpy = vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fake-signature-png-bytes'));

      const buffer = await InstitutionAssetService.getAssetBuffer('principal/signature');
      expect(buffer).not.toBeNull();
      expect(buffer.toString()).toBe('fake-signature-png-bytes');

      existsSpy.mockRestore();
      statSpy.mockRestore();
      readSpy.mockRestore();
    });
  });
});
