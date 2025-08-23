import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.S3_ACCESS_KEY!,
  secretAccessKey: process.env.S3_SECRET_KEY!,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

export const uploadFile = async (file: Express.Multer.File, folder: string): Promise<string> => {
  const key = `${folder}/${uuidv4()}-${file.originalname}`;
  
  const params = {
    Bucket: process.env.S3_BUCKET || 'edustream',
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
  try {
    const key = fileUrl.split('/').slice(-2).join('/');
    
    const params = {
      Bucket: process.env.S3_BUCKET || 'edustream',
      Key: key
    };

    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Delete file error:', error);
  }
};