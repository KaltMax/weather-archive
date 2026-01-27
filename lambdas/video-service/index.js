const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// Set FFmpeg path from ffmpeg-static (includes Linux binary for Lambda)
ffmpeg.setFfmpegPath(ffmpegPath);

// S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false, 
  },
  connectionTimeoutMillis: 2000,
});

// Video configuration
const VIDEO_CONFIG = {
  fps: 1,                    // 1 frame (image) per second
  videoBitrate: '200k',      // Video bitrate
  codec: 'libx264',          // H.264 codec for web compatibility
  format: 'mp4',
  preset: 'medium',          // Encoding speed vs compression (ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow)
  timeRangeHours: 1,         // Process last 1 hour of images
  //timeRangeHours: 24,      // just to test the video service
};

exports.handler = async (event) => {
  console.log('VideoService Lambda triggered', JSON.stringify(event, null, 2));

  try {
    // Get all cities
    const citiesResult = await pool.query('SELECT name FROM cities ORDER BY name');
    const cities = citiesResult.rows.map(row => row.name);

    console.log(`Processing videos for ${cities.length} cities:`, cities);

    // Process each city
    const results = await Promise.allSettled(
      cities.map(city => generateVideoForCity(city))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`Processed ${cities.length} cities: ${successful} successful, ${failed} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        citiesProcessed: cities.length,
        videosCreated: successful,
        failed: failed,
      }),
    };

  } catch (error) {
    console.error('Error in VideoService Lambda:', error);
    throw error;
  }
};

async function generateVideoForCity(city) {
  console.log(`\n=== Processing city: ${city} ===`);

  const tmpDir = `/tmp/${city}-${Date.now()}`;

  try {
    // Query for unprocessed images from the last N hours
    const cutoffTime = new Date(Date.now() - VIDEO_CONFIG.timeRangeHours * 60 * 60 * 1000);

    console.log(`Querying for images after ${cutoffTime.toISOString()}`);

    const imagesResult = await pool.query(
      `SELECT
        id,
        compressed_image_path,
        timestamp
      FROM picture_metadata
      WHERE city = $1
        AND is_processed = true
        AND timestamp >= $2
        AND id NOT IN (
          -- Exclude images already used in videos
          SELECT DISTINCT pm.id
          FROM picture_metadata pm
          JOIN videos v ON pm.city = v.city
            AND pm.timestamp >= v.start_date
            AND pm.timestamp <= v.end_date
          WHERE pm.city = $1
        )
      ORDER BY timestamp ASC
      LIMIT 300`,  // Limit the amount of images to avoid excessive processing
      [city, cutoffTime]
    );

    if (imagesResult.rows.length === 0) {
      console.log(`No new images found for ${city}`);
      return { success: true, skipped: true, reason: 'No new images' };
    }

    console.log(`Found ${imagesResult.rows.length} images for ${city}`);

    // Create temporary directory
    await fs.promises.mkdir(tmpDir, { recursive: true });
    console.log(`Created temp directory: ${tmpDir}`);

    // Download images from S3
    console.log('Downloading images from S3...');

    const imageFiles = await Promise.all(
      imagesResult.rows.map(async (row, index) => {
        const paddedIndex = String(index).padStart(5, '0');
        const filename = `frame_${paddedIndex}.jpg`;
        const filePath = path.join(tmpDir, filename);

        const getCommand = new GetObjectCommand({
          Bucket: process.env.S3_PROCESSED_IMAGES_BUCKET,
          Key: row.compressed_image_path,
        });

        const response = await s3Client.send(getCommand);
        const buffer = await streamToBuffer(response.Body);
        await fs.promises.writeFile(filePath, buffer);

        return {
          path: filePath,
          timestamp: row.timestamp,
        };
      })
    );

    console.log(`Downloaded ${imageFiles.length} images`);

    // Generate video using FFmpeg
    const startDate = new Date(imagesResult.rows[0].timestamp);
    const endDate = new Date(imagesResult.rows[imagesResult.rows.length - 1].timestamp);

    const videoFileName = `${city}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.mp4`;
    const outputVideoPath = path.join(tmpDir, videoFileName);

    console.log('Creating video with FFmpeg...');
    console.log(`Input pattern: ${tmpDir}/frame_%05d.jpg`);
    console.log(`Output: ${outputVideoPath}`);

    await createVideo(tmpDir, outputVideoPath);

    const videoStats = await fs.promises.stat(outputVideoPath);
    console.log(`Video created: ${videoStats.size} bytes`);

    // Upload video to S3
    const s3VideoKey = `${city}/${videoFileName}`;
    console.log(`Uploading video to S3: ${s3VideoKey}`);

    const videoBuffer = await fs.promises.readFile(outputVideoPath);

    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_VIDEOS_BUCKET,
      Key: s3VideoKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      Metadata: {
        'city': city,
        'frame-count': String(imageFiles.length),
        'start-date': startDate.toISOString(),
        'end-date': endDate.toISOString(),
      },
    });

    await s3Client.send(putCommand);
    console.log('Video uploaded successfully');

    // Calculate video duration in seconds
    const durationSeconds = Math.round(imageFiles.length / VIDEO_CONFIG.fps);

    // Insert video metadata into database
    console.log('Inserting video metadata into database');

    await pool.query(
      `INSERT INTO videos
       (city, video_path, start_date, end_date, frame_count, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [city, s3VideoKey, startDate, endDate, imageFiles.length, durationSeconds]
    );

    console.log('Database updated successfully');

    // Cleanup temporary files
    console.log('Cleaning up temporary files...');
    await fs.promises.rm(tmpDir, { recursive: true, force: true });

    return {
      success: true,
      city,
      videoPath: s3VideoKey,
      frameCount: imageFiles.length,
      durationSeconds,
      startDate,
      endDate,
    };

  } catch (error) {
    console.error(`Error generating video for ${city}:`, error);

    // Cleanup on error
    try {
      if (fs.existsSync(tmpDir)) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }

    return { success: false, city, error: error.message };
  }
}

// Create video using FFmpeg
function createVideo(inputDir, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(inputDir, 'frame_%05d.jpg'))
      .inputFPS(VIDEO_CONFIG.fps)
      .videoCodec(VIDEO_CONFIG.codec)
      .videoBitrate(VIDEO_CONFIG.videoBitrate)
      .outputOptions([
        `-preset ${VIDEO_CONFIG.preset}`,
        '-pix_fmt yuv420p',  // Ensure compatibility with web browsers
        '-movflags +faststart',  // Enable progressive streaming
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.frames} frames, ${progress.timemark} duration`);
      })
      .on('end', () => {
        console.log('FFmpeg processing finished successfully');
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Helper function to format date for filename
function formatDateForFilename(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
}
