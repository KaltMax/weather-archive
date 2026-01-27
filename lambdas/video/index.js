const { Client } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('redis');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_VIDEOS_BUCKET || 'weather-archive-videos';

let redisClient = null;

// Get or create Redis client
async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      connectTimeout: 2000,
      reconnectStrategy: () => false,
    },
    password: process.env.REDIS_PASSWORD,
  });

  redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  await redisClient.connect();
  console.log('Redis client connected');
  return redisClient;
}

exports.handler = async (event) => {
  console.log('GetVideo Lambda invoked', JSON.stringify(event, null, 2));

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const city = event.pathParameters?.city;
  const date = event.queryStringParameters?.date;
  const hour = event.queryStringParameters?.hour;

  if (!city || !date || hour === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'Please provide city (path), date, and hour (query parameters)',
      }),
    };
  }

  const timestamp = `${date}T${hour.toString().padStart(2, '0')}:00:00`;

  // Generate unique cache key from parameters
  const cacheKey = `video:${city}:${date}:${hour}`;
  console.log('Cache key:', cacheKey);

  // Try to get data from Redis cache
  try {
    const redis = await getRedisClient();
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log('Cache HIT - Returning cached video data');
      const parsedData = JSON.parse(cachedData);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...parsedData,
          cached: true  
        })
      };
    }
    console.log('Cache MISS - Querying database');
  } catch (redisError) {
    console.error('Redis error, falling back to database:', redisError);
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Check if video metadata exists in the database
    const result = await client.query(
      `SELECT
        id,
        city,
        video_path as "videoPath",
        start_date as "startDate",
        end_date as "endDate",
        frame_count as "frameCount",
        duration_seconds as "durationSeconds",
        created_at as "createdAt"
      FROM videos
      WHERE city = $1
        AND start_date <= $2::timestamp
        AND end_date >= $2::timestamp
      ORDER BY created_at DESC
      LIMIT 1`,
      [city, timestamp]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Not Found',
          message: `No video available for ${city} on ${date} at hour ${hour}`,
        }),
      };
    }

    const video = result.rows[0];
    console.log(`Found video for ${city}:`, video);

    // Generate presigned URL for the video
    const key = video.videoPath;
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    const responseData = {
      city,
      date,
      hour,
      videoUrl: signedUrl,
      videoMetadata: video,
      cached: false,
    };

    // Store result in Redis with TTL (30 minutes = 1800 seconds)
    try {
      const redis = await getRedisClient();
      const dataToCache = {
        city: responseData.city,
        date: responseData.date,
        hour: responseData.hour,
        videoUrl: responseData.videoUrl,
        videoMetadata: responseData.videoMetadata
      };
      await redis.setEx(cacheKey, 1800, JSON.stringify(dataToCache));
      console.log('Video data cached successfully with TTL 1800s');
    } catch (redisError) {
      console.error('Failed to cache result:', redisError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error('Error in GetVideo Lambda:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to fetch video',
        details: error.message
      }),
    };
  } finally {
    try {
      await client.end();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
};
