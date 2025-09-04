// course-service/src/services/fileService.ts
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = process.env.S3_BUCKET || 'edustream';

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY!,
  secretAccessKey: process.env.S3_SECRET_KEY!,
  s3ForcePathStyle: true,     // ✅ MinIO/path-style
  signatureVersion: 'v4',
  region: 'us-east-1',        // safe default for MinIO
});

// ✅ Ensure bucket exists (runs once, cached)
let bucketReady: Promise<void> | null = null;
async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    try {
      await s3.headBucket({ Bucket: BUCKET }).promise();
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.code === 'NotFound' || err?.code === 'NoSuchBucket') {
        await s3.createBucket({ Bucket: BUCKET }).promise();
      } else {
        throw err;
      }
    }
  })();
  return bucketReady;
}

export const uploadFile = async (file: Express.Multer.File, folder: string): Promise<string> => {
  await ensureBucket();

  const key = `${folder}/${uuidv4()}-${file.originalname}`;
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',   // ok for MinIO if policy allows; otherwise MinIO ignores
  };

  const result = await s3.upload(params).promise();

  // Optional: make a browser-friendly URL if S3_ENDPOINT is internal
  const publicBase = (process.env.S3_PUBLIC_BASE || process.env.S3_ENDPOINT || '').replace(/\/+$/, '');
  if (publicBase) return `${publicBase}/${BUCKET}/${key}`;

  // Fallback to SDK's Location (may be internal like http://minio:9000/…)
  return result.Location;
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
  try {
    // Expect .../<bucket>/<folder>/<file>
    const parts = fileUrl.split('/');
    const bucketIdx = parts.findIndex(p => p === BUCKET);
    const key = bucketIdx >= 0 ? parts.slice(bucketIdx + 1).join('/') : parts.slice(-2).join('/');
    await ensureBucket();
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
  } catch (error) {
    console.error('Delete file error:', error);
  }
};
