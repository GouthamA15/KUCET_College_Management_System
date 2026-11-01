import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { logAudit } from '@/lib/api-utils';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('@/db', () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn() })) }
}));

describe('audit and Cloudinary remediation', () => {
  const req = { headers: new Headers({ 'user-agent': 'test-agent' }) };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    cloudinary.config({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: 'test-secret' });
  });

  it.each(['STAFF', 'ADMIN', 'STUDENT', 'SYSTEM'])(
    'persists supported actor type %s using the database enum spelling', async (userType) => {
      const values = vi.fn().mockResolvedValue(undefined);
      db.insert.mockReturnValue({ values });

      await logAudit(req, { userId: 42, userType, action: 'TEST_ACTION' });

      expect(values).toHaveBeenCalledWith(expect.objectContaining({ user_type: userType.toLowerCase() }));
    }
  );

  it('propagates persistence failures so a successful response cannot conceal a missing audit record', async () => {
    const values = vi.fn().mockRejectedValue(new Error('database unavailable'));
    db.insert.mockReturnValue({ values });

    await expect(logAudit(req, { userId: 42, userType: 'STAFF', action: 'TEST_ACTION' }))
      .rejects.toThrow('Audit record could not be persisted');
  });

  it('does not attempt deletion when Cloudinary credentials are absent', async () => {
    delete process.env.CLOUDINARY_API_KEY;
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy');

    await expect(deleteFromCloudinary('kucet/students/pfp/test-asset.webp'))
      .rejects.toThrow('missing CLOUDINARY_API_KEY');
    expect(destroy).not.toHaveBeenCalled();
    destroy.mockRestore();
  });

  it('treats a provider response for an already missing asset as a completed idempotent delete', async () => {
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'not found' });

    await expect(deleteFromCloudinary('kucet/students/pfp/test-asset.webp'))
      .resolves.toEqual({ result: 'not found' });
    expect(destroy).toHaveBeenCalledWith('kucet/students/pfp/test-asset');
    destroy.mockRestore();
  });
});
