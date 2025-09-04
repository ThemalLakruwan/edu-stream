// course-service/src/services/fileService.ts - FIXED VERSION
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

  // ✅ FIXED: Use nginx proxy URL, not frontend URL
  // The files are served through nginx proxy at port 8080, not frontend at 3000
  const proxyBase = process.env.S3_PUBLIC_BASE || 'http://localhost:8080/files';
  const publicUrl = `${proxyBase}/${BUCKET}/${key}`;

  console.log(`File uploaded: ${publicUrl}`);
  return publicUrl;
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
  try {
    // Extract key from proxy URL or direct MinIO URL
    let key: string;

    if (fileUrl.includes('/files/')) {
      // Proxy URL format: http://localhost:8080/files/edustream/course-thumbnails/uuid-filename.jpg
      // Extract everything after /files/edustream/
      const parts = fileUrl.split('/files/');
      if (parts.length > 1) {
        const pathAfterFiles = parts[1];
        // Remove bucket name if present
        if (pathAfterFiles.startsWith(`${BUCKET}/`)) {
          key = pathAfterFiles.substring(`${BUCKET}/`.length);
        } else {
          key = pathAfterFiles;
        }
      } else {
        throw new Error('Invalid file URL format');
      }
    } else {
      // Fallback: try to extract from direct MinIO URL
      const parts = fileUrl.split('/');
      const bucketIdx = parts.findIndex(p => p === BUCKET);
      key = bucketIdx >= 0 ? parts.slice(bucketIdx + 1).join('/') : parts.slice(-2).join('/');
    }

    await ensureBucket();
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
    console.log(`File deleted: ${key}`);
  } catch (error) {
    console.error('Delete file error:', error);
  }
};