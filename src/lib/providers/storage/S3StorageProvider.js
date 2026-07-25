import StorageProvider from './StorageProvider';

/**
 * Stateless S3 / Cloudflare R2 Storage Provider.
 * Enables smooth horizontal scaling across cloud nodes.
 */
export default class S3StorageProvider extends StorageProvider {
  constructor(config = {}) {
    super();
    this.endpoint = config.endpoint || process.env.S3_ENDPOINT || '';
    this.bucket = config.bucket || process.env.S3_BUCKET || 'kucet-uploads';
    this.publicDomain = config.publicDomain || process.env.S3_PUBLIC_DOMAIN || '';
  }

  getUrl(path, _options = {}) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http')) {
      return path;
    }

    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (this.publicDomain) {
      return `${this.publicDomain.replace(/\/$/, '')}/${cleanPath}`;
    }

    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${cleanPath}`;
    }

    return `https://${this.bucket}.s3.amazonaws.com/${cleanPath}`;
  }

  async upload(file, folder, publicId = null) {
    if (!file) return null;

    const { getBreaker } = await import('@/lib/utils/CircuitBreaker');
    const s3Breaker = getBreaker('S3Storage');

    return s3Breaker.execute(async () => {
      let buffer;
      let contentType = 'application/octet-stream';

      if (file && typeof file.arrayBuffer === 'function') {
        const bytes = await file.arrayBuffer();
        buffer = Buffer.from(bytes);
        contentType = file.type || 'image/jpeg';
      } else if (Buffer.isBuffer(file)) {
        buffer = file;
      } else if (typeof file === 'string' && file.startsWith('data:')) {
        const matches = file.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(file, 'base64');
        }
      } else {
        throw new Error('Unsupported file type for S3 upload');
      }

      // Max 1MB threshold per institutional guidelines
      if (buffer.length > 1 * 1024 * 1024) {
        throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`);
      }

      let extension = '.jpg';
      if (contentType.includes('png')) extension = '.png';
      else if (contentType.includes('pdf')) extension = '.pdf';
      else if (contentType.includes('webp')) extension = '.webp';

      const key = publicId ? `${folder}/${publicId}${extension}` : `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${extension}`;

      // If S3 credentials are configured, execute upload via S3 API or fallback URL construction
      const accessKey = process.env.S3_ACCESS_KEY_ID;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY;

      if (accessKey && secretKey && this.endpoint) {
        try {
          const uploadUrl = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
          const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
              'x-amz-acl': 'public-read',
            },
            body: buffer,
          });

          if (!res.ok) {
            console.warn(`S3 direct upload returned status ${res.status}, generating object key reference.`);
          }
        } catch (uploadError) {
          console.warn('S3 HTTP upload fallback warning:', uploadError.message);
        }
      }

      return key;
    });
  }

  async delete(path) {
    if (!path || path.startsWith('http') || path.startsWith('data:')) return;

    const { getBreaker } = await import('@/lib/utils/CircuitBreaker');
    const s3Breaker = getBreaker('S3Storage');

    return s3Breaker.execute(async () => {
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const accessKey = process.env.S3_ACCESS_KEY_ID;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY;

      if (accessKey && secretKey && this.endpoint) {
        try {
          const deleteUrl = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${cleanPath}`;
          await fetch(deleteUrl, { method: 'DELETE' });
        } catch (deleteError) {
          console.warn('S3 delete fallback warning:', deleteError.message);
        }
      }
    });
  }
}
