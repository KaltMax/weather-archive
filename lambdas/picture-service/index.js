const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const sharp = require('sharp');

// S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,                                // Maximum number of connections in the pool per lambda instance
  idleTimeoutMillis: 30000,               // Higher timeout for picture processing
  ssl: {
    rejectUnauthorized: false,            // Required for AWS RDS
  },
  connectionTimeoutMillis: 2000,
});

// Configuration for image processing
const IMAGE_CONFIG = {
  maxWidth: 1280,
  maxHeight: 720,
  quality: 80,
  format: 'jpeg',
};

exports.handler = async (event) => {
  console.log('PictureService Lambda triggered', JSON.stringify(event, null, 2));

  // Process each S3 event record (image) concurrently
  const results = await Promise.allSettled(
    event.Records.map(record => processImage(record))
  );

  // Log results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Processed ${results.length} images: ${successful} successful, ${failed} failed`);

  if (failed > 0) {
    console.error('Failed records:', results.filter(r => r.status === 'rejected').map(r => r.reason));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: successful,
      failed: failed,
    }),
  };
};

async function processImage(record) {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  console.log(`Processing image: ${bucket}/${key}`);

  try {
    // 1. Download the raw image from S3
    console.log(`Downloading image from S3: ${key}`);
    const getCommand = new GetObjectCommand({
      Bucket: process.env.S3_RAW_IMAGES_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(getCommand);
    const imageBuffer = await streamToBuffer(response.Body);
    const originalSize = imageBuffer.length;

    console.log(`Downloaded image: ${originalSize} bytes`);

    // 2. Compress and resize the image using Sharp
    console.log(`Compressing image with Sharp (max: ${IMAGE_CONFIG.maxWidth}x${IMAGE_CONFIG.maxHeight}, quality: ${IMAGE_CONFIG.quality}%)`);

    const compressedBuffer = await sharp(imageBuffer)
      .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
        fit: 'fill',
      })
      .jpeg({
        quality: IMAGE_CONFIG.quality,
        progressive: true,
      })
      .toBuffer();

    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    console.log(`Compressed image: ${compressedSize} bytes (${compressionRatio}% reduction)`);

    // 3. Generate the output S3 key
    // Input:  {city}/{timestamp}.jpg (from raw images bucket)
    // Output: {city}/{timestamp}.jpg (to processed images bucket)
    const outputKey = key;

    // 4. Upload the compressed image to S3
    console.log(`Uploading compressed image to S3: ${outputKey}`);

    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_PROCESSED_IMAGES_BUCKET,
      Key: outputKey,
      Body: compressedBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'original-size': originalSize.toString(),
        'compressed-size': compressedSize.toString(),
        'compression-ratio': compressionRatio,
      },
    });

    await s3Client.send(putCommand);
    console.log('Compressed image uploaded successfully');

    // 5. Update the picture_metadata table in the database
    console.log('Updating picture_metadata in database');

    const updateResult = await pool.query(
      `UPDATE picture_metadata
       SET compressed_image_path = $1,
           compressed_size_bytes = $2,
           is_processed = true,
           processed_at = CURRENT_TIMESTAMP
       WHERE raw_image_path = $3`,
      [outputKey, compressedSize, key]
    );

    if (updateResult.rowCount === 0) {
      console.warn(`No picture_metadata record found for raw_image_path: ${key}`);
    } else {
      console.log('Database updated successfully');
    }

    return {
      success: true,
      key,
      outputKey,
      originalSize,
      compressedSize,
      compressionRatio,
    };

  } catch (error) {
    console.error(`Error processing image ${key}:`, error);
    throw error;
  }
}

// Helper function to convert stream to buffer because we get a stream from S3 GetObjectCommand and Sharp needs a buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
