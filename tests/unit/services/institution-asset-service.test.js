import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstitutionAssetService, INSTITUTION_ASSET_REGISTRY } from '../../../src/services/institution/InstitutionAssetService.js';
import { INSTITUTION_ASSET_KEYS, resolveInstitutionalFilename, isInstitutionalAssetPath } from '../../../src/lib/institution-assets.js';
import LocalStorageProvider from '../../../src/lib/providers/storage/LocalStorageProvider.js';
import CloudinaryStorageProvider from '../../../src/lib/providers/storage/CloudinaryStorageProvider.js';

describe('InstitutionAssetService & Architecture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('1. Logical Key Resolution & Registry Mapping', () => {
    it('should resolve principal signature by logical key', () => {
      const asset = InstitutionAssetService.resolveAsset('principal/signature');
      expect(asset).not.toBeNull();
      expect(asset.filename).toBe('principal-sign.png');
      expect(asset.category).toBe('principal');
    });

    it('should resolve signature stamp by logical key', () => {
      const asset = InstitutionAssetService.resolveAsset('principal/signature-stamp');
      expect(asset).not.toBeNull();
      expect(asset.filename).toBe('principal-signStamp.png');
    });

    it('should resolve college seal by logical key', () => {
      const asset = InstitutionAssetService.resolveAsset('institution/seal');
      expect(asset).not.toBeNull();
      expect(asset.filename).toBe('ku-college-seal.png');
    });

    it('should resolve legacy filenames and relative paths to canonical logical keys', () => {
      expect(InstitutionAssetService.getLogicalKey('principal-sign.png')).toBe('principal/signature');
      expect(InstitutionAssetService.getLogicalKey('/assets/principal-signStamp.png')).toBe('principal/signature-stamp');
      expect(InstitutionAssetService.getLogicalKey('ku-college-seal.png')).toBe('institution/seal');
      expect(InstitutionAssetService.getLogicalKey('/assets/principal_ku_qr.png')).toBe('principal/qr');
    });
  });

  describe('2. Client & Browser Safe Resolution (institution-assets.js)', () => {
    it('should map INSTITUTION_ASSET_KEYS to canonical filenames', () => {
      expect(resolveInstitutionalFilename(INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE)).toBe('principal-sign.png');
      expect(resolveInstitutionalFilename(INSTITUTION_ASSET_KEYS.INSTITUTION_SEAL)).toBe('ku-college-seal.png');
      expect(resolveInstitutionalFilename(INSTITUTION_ASSET_KEYS.INSTITUTION_LOGO)).toBe('ku-logo.png');
    });

    it('should identify protected institutional asset paths', () => {
      expect(isInstitutionalAssetPath('assets/principal-sign.png')).toBe(true);
      expect(isInstitutionalAssetPath('institution/seal')).toBe(true);
      expect(isInstitutionalAssetPath('principal-signStamp.png')).toBe(true);
      expect(isInstitutionalAssetPath('students/pfp')).toBe(false);
      expect(isInstitutionalAssetPath('requests/proofs')).toBe(false);
    });
  });

  describe('3. Storage URL Resolution across Environments', () => {
    it('should resolve local asset URLs via /assets/ path', () => {
      process.env.STORAGE_TYPE = 'local';
      const url = InstitutionAssetService.getAssetUrl('principal/signature');
      expect(url).toBe('/assets/principal-sign.png');
    });

    it('should resolve Cloudinary institutional asset URLs via kucet/institution namespace', () => {
      process.env.STORAGE_TYPE = 'cloudinary';
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      const url = InstitutionAssetService.getAssetUrl('institution/seal');
      expect(url).toContain('res.cloudinary.com/test_cloud/image/upload/f_auto,q_auto/kucet/institution/ku-college-seal.png');
    });
  });

  describe('4. Server-Side Data URL Generation for Certificate PDFs', () => {
    it('should generate valid base64 data URLs for local disk assets', async () => {
      const dataUrl = await InstitutionAssetService.getAssetDataUrl('institution/logo');
      expect(dataUrl).not.toBeNull();
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('5. Security & Public Upload Protection', () => {
    it('LocalStorageProvider should throw when trying to upload to an institutional asset path', async () => {
      const provider = new LocalStorageProvider();
      const fakeBuffer = Buffer.from('fake image content');
      await expect(provider.upload(fakeBuffer, 'assets/signatures')).rejects.toThrow(
        'Public upload or modification of institutional assets is strictly prohibited.'
      );
      await expect(provider.upload(fakeBuffer, 'institution/seal')).rejects.toThrow(
        'Public upload or modification of institutional assets is strictly prohibited.'
      );
    });

    it('CloudinaryStorageProvider should throw when trying to upload to an institutional asset path', async () => {
      const provider = new CloudinaryStorageProvider('test_cloud');
      const fakeBuffer = Buffer.from('fake image content');
      await expect(provider.upload(fakeBuffer, 'institution/principal')).rejects.toThrow(
        'Public upload or modification of institutional assets is strictly prohibited.'
      );
    });
  });
});
