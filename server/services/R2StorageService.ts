import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { db } from '../store.js';

export interface R2Config {
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
}

export interface StoredFile {
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
  storageProvider: 'cloudflare-r2' | 'local-cache';
}

class R2StorageService {
  private defaultAccountId = 'b1aabfa2a055b8aa67596c2bd7a69cd0';
  private defaultEndpoint = 'https://b1aabfa2a055b8aa67596c2bd7a69cd0.r2.cloudflarestorage.com';
  private localFiles = new Map<string, { buffer: Buffer; meta: StoredFile }>();

  getConfig(): R2Config {
    const saved = (db.settings as any)?.r2 || {};
    return {
      accountId: saved.accountId || process.env.R2_ACCOUNT_ID || this.defaultAccountId,
      endpoint: saved.endpoint || process.env.R2_S3_ENDPOINT || this.defaultEndpoint,
      accessKeyId: saved.accessKeyId || process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: saved.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: saved.bucketName || process.env.R2_BUCKET_NAME || 'emailops-assets',
      publicDomain: saved.publicDomain || process.env.R2_PUBLIC_DOMAIN || '',
    };
  }

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return Boolean(cfg.accountId && cfg.endpoint && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName);
  }

  getClient(): S3Client | null {
    const cfg = this.getConfig();
    if (!cfg.accessKeyId || !cfg.secretAccessKey) return null;

    return new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async testConnection(customConfig?: Partial<R2Config>): Promise<{ success: boolean; message: string; bucket?: string }> {
    const current = this.getConfig();
    const config = { ...current, ...customConfig };

    if (!config.accessKeyId || !config.secretAccessKey) {
      return {
        success: false,
        message: 'Missing Access Key ID or Secret Access Key for Cloudflare R2.',
      };
    }

    try {
      const client = new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      // Try listing up to 1 object or checking bucket
      await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          MaxKeys: 1,
        })
      );

      return {
        success: true,
        message: `Successfully connected to Cloudflare R2 bucket "${config.bucketName}"! (0$ Egress active)`,
        bucket: config.bucketName,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('NoSuchBucket')) {
        return {
          success: false,
          message: `Bucket "${config.bucketName}" was not found in Cloudflare R2. Please create the bucket in Cloudflare R2 Dashboard first.`,
        };
      }
      if (msg.includes('SignatureDoesNotMatch') || msg.includes('InvalidAccessKeyId')) {
        return {
          success: false,
          message: 'Invalid R2 credentials. Check your Access Key ID and Secret Access Key.',
        };
      }
      return {
        success: false,
        message: `Cloudflare R2 Connection Error: ${msg}`,
      };
    }
  }

  async uploadFile(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    prefix?: string;
  }): Promise<StoredFile> {
    const cfg = this.getConfig();
    const client = this.getClient();
    const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = params.prefix ? params.prefix.replace(/\/$/, '') + '/' : 'assets/';
    const key = `${folder}${Date.now()}_${safeName}`;
    const now = new Date().toISOString();

    let publicUrl = `/api/storage/raw/${key}`;
    if (cfg.publicDomain) {
      const baseDomain = cfg.publicDomain.replace(/\/$/, '');
      publicUrl = `${baseDomain}/${key}`;
    }

    const fileMeta: StoredFile = {
      key,
      filename: params.filename,
      size: params.buffer.length,
      mimeType: params.mimeType,
      url: publicUrl,
      uploadedAt: now,
      storageProvider: client ? 'cloudflare-r2' : 'local-cache',
    };

    if (client && cfg.bucketName) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: cfg.bucketName,
            Key: key,
            Body: params.buffer,
            ContentType: params.mimeType,
          })
        );
      } catch (err: any) {
        console.warn('[R2StorageService] Failed to upload to Cloudflare R2, falling back to memory store:', err?.message);
        fileMeta.storageProvider = 'local-cache';
      }
    }

    // Always keep in local registry for instant listing and fallback
    this.localFiles.set(key, { buffer: params.buffer, meta: fileMeta });
    return fileMeta;
  }

  async listFiles(): Promise<StoredFile[]> {
    const cfg = this.getConfig();
    const client = this.getClient();
    const result: StoredFile[] = [];

    if (client && cfg.bucketName) {
      try {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: cfg.bucketName,
            MaxKeys: 100,
          })
        );

        if (response.Contents) {
          for (const item of response.Contents) {
            if (!item.Key) continue;
            const filename = item.Key.split('/').pop() || item.Key;
            let url = `/api/storage/raw/${item.Key}`;
            if (cfg.publicDomain) {
              url = `${cfg.publicDomain.replace(/\/$/, '')}/${item.Key}`;
            }

            result.push({
              key: item.Key,
              filename,
              size: item.Size || 0,
              mimeType: this.guessMimeType(filename),
              url,
              uploadedAt: item.LastModified?.toISOString() || new Date().toISOString(),
              storageProvider: 'cloudflare-r2',
            });
          }
          return result;
        }
      } catch (err: any) {
        console.warn('[R2StorageService] listFiles failed from Cloudflare R2, returning local files:', err?.message);
      }
    }

    // Return locally tracked files
    return Array.from(this.localFiles.values()).map((v) => v.meta);
  }

  async getFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const local = this.localFiles.get(key);
    if (local) {
      return { buffer: local.buffer, mimeType: local.meta.mimeType };
    }

    const client = this.getClient();
    const cfg = this.getConfig();
    if (!client || !cfg.bucketName) return null;

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: cfg.bucketName,
          Key: key,
        })
      );

      if (response.Body) {
        const byteArray = await response.Body.transformToByteArray();
        const buffer = Buffer.from(byteArray);
        const mimeType = response.ContentType || this.guessMimeType(key);
        return { buffer, mimeType };
      }
    } catch (err: any) {
      console.warn(`[R2StorageService] getFile failed for key ${key}:`, err?.message);
    }
    return null;
  }

  async deleteFile(key: string): Promise<boolean> {
    this.localFiles.delete(key);
    const client = this.getClient();
    const cfg = this.getConfig();
    if (!client || !cfg.bucketName) return true;

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: cfg.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (err: any) {
      console.warn(`[R2StorageService] deleteFile failed for key ${key}:`, err?.message);
      return false;
    }
  }

  private guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'csv':
        return 'text/csv';
      case 'html':
        return 'text/html';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}

export const r2StorageService = new R2StorageService();
