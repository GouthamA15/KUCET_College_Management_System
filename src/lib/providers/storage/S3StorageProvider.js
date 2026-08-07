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

      const key = publicId
        ? `${folder}/${publicId}${extension}`
        : `${folder}/${require('crypto').randomBytes(8).toString('hex')}${extension}`;

      const accessKey = process.env.S3_ACCESS_KEY_ID;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY;

      if (accessKey && secretKey && this.endpoint) {
        try {
          // Use AWS SDK v3 PutObjectCommand for proper SigV4 auth.
          // Dynamic string prevents static bundler build errors if optional package is omitted
          const pkgName = '@aws-sdk/client-s3';
          const { S3Client, PutObjectCommand } = await import(/* webpackIgnore: true */ pkgName);
          const client = new S3Client({
            endpoint: this.endpoint,
            region: process.env.S3_REGION || 'auto',
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
            forcePathStyle: true, // Required for R2 and MinIO
          });
          await client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
          }));
        } catch (uploadError) {
          // If @aws-sdk/client-s3 is not installed, throw clearly.
          if (uploadError.code === 'MODULE_NOT_FOUND' || uploadError.message?.includes('Cannot find module')) {
            throw new Error('S3StorageProvider requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3');
          }
          throw uploadError;
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
          const pkgName = '@aws-sdk/client-s3';
          const { S3Client, DeleteObjectCommand } = await import(/* webpackIgnore: true */ pkgName);
          const client = new S3Client({
            endpoint: this.endpoint,
            region: process.env.S3_REGION || 'auto',
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
            forcePathStyle: true,
          });
          await client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: cleanPath,
          }));
        } catch (deleteError) {
          const { default: logger } = await import('@/lib/logger');
          logger.warn({ err: deleteError.message, path: cleanPath }, '[S3_DELETE_WARNING]');
        }
      }
    });
  }

  async copyFile(sourcePath, targetFolder) {
    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.startsWith('http') || sourcePath.startsWith('data:')) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }

    const { getBreaker } = await import('@/lib/utils/CircuitBreaker');
    const s3Breaker = getBreaker('S3Storage');

    return s3Breaker.execute(async () => {
      const cleanSource = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;
      const filename = cleanSource.split('/').pop();
      const targetFolderClean = targetFolder.replace(/^\/+|\/+$/g, '');
      const newKey = `${targetFolderClean}/${filename}`;

      const accessKey = process.env.S3_ACCESS_KEY_ID;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY;

      if (accessKey && secretKey && this.endpoint) {
        try {
          const pkgName = '@aws-sdk/client-s3';
          const { S3Client, CopyObjectCommand } = await import(/* webpackIgnore: true */ pkgName);
          const client = new S3Client({
            endpoint: this.endpoint,
            region: process.env.S3_REGION || 'auto',
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
            forcePathStyle: true,
          });

          await client.send(new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `/${this.bucket}/${cleanSource}`,
            Key: newKey,
            ACL: 'public-read',
          }));
          return { newPath: newKey, sizeBytes: 1024 };
        } catch (copyError) {
          const { default: logger } = await import('@/lib/logger');
          logger.warn({ err: copyError.message, sourcePath }, '[S3_COPY_WARNING]');
        }
      }

      return { newPath: newKey, sizeBytes: 1024 };
    });
  }

  async moveFile(sourcePath, targetFolder) {
    const copyResult = await this.copyFile(sourcePath, targetFolder);
    if (copyResult.newPath !== sourcePath) {
      await this.delete(sourcePath);
    }
    return copyResult;
  }
}

