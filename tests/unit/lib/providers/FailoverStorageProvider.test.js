import { describe, it, expect, vi } from 'vitest';
import FailoverStorageProvider from '@/lib/providers/storage/FailoverStorageProvider';

describe('FailoverStorageProvider', () => {
  it('should upload using primary provider when primary succeeds', async () => {
    const primary = {
      constructor: { name: 'S3StorageProvider' },
      upload: vi.fn().mockResolvedValue('https://s3.example.com/file.jpg'),
    };
    const secondary = {
      constructor: { name: 'CloudinaryStorageProvider' },
      upload: vi.fn().mockResolvedValue('https://cloudinary.example.com/file.jpg'),
    };

    const failover = new FailoverStorageProvider([primary, secondary]);
    const res = await failover.upload(Buffer.from('test'), 'file.jpg');

    expect(res).toBe('https://s3.example.com/file.jpg');
    expect(primary.upload).toHaveBeenCalledTimes(1);
    expect(secondary.upload).not.toHaveBeenCalled();
  });

  it('should failover to secondary provider when primary fails', async () => {
    const primary = {
      constructor: { name: 'S3StorageProvider' },
      upload: vi.fn().mockRejectedValue(new Error('S3 Outage')),
    };
    const secondary = {
      constructor: { name: 'CloudinaryStorageProvider' },
      upload: vi.fn().mockResolvedValue('https://cloudinary.example.com/file.jpg'),
    };

    const failover = new FailoverStorageProvider([primary, secondary]);
    const res = await failover.upload(Buffer.from('test'), 'file.jpg');

    expect(res).toBe('https://cloudinary.example.com/file.jpg');
    expect(primary.upload).toHaveBeenCalledTimes(1);
    expect(secondary.upload).toHaveBeenCalledTimes(1);
  });
});
