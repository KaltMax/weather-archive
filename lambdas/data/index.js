const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_RAW_IMAGES_BUCKET || 'weather-archive-raw-images';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const dbClient = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false // Required for AWS RDS
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    const body = JSON.parse(event.body);
    const { city, temperature, humidity, airPressure, image, timestamp: requestTimestamp } = body;

    // Validate required fields
    if (!city || temperature === undefined || humidity === undefined || airPressure === undefined || !image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const timestamp = requestTimestamp ? new Date(requestTimestamp) : new Date();

    // Generate S3 key for the image
    const imageKey = `${city}/${timestamp.getTime()}.jpg`;

    // Upload image to S3 - strip data URL prefix from base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }));

    console.log(`Image uploaded to S3: ${imageKey}`);

    // Store weather data in database
    await dbClient.connect();
    console.log('Connected to database');

    // Insert weather data for every upload (every 5 minutes)
    const weatherResult = await dbClient.query(
      `INSERT INTO weather_data (city, temperature, humidity, air_pressure, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [city, temperature, humidity, airPressure, timestamp]
    );

    console.log(`Weather data inserted for ${city} at ${timestamp}`);

    await dbClient.query(
      `INSERT INTO cities (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [city]
    );

    await dbClient.query(
      `INSERT INTO picture_metadata (city, raw_image_path, timestamp, file_size_bytes)
       VALUES ($1, $2, $3, $4)`,
      [city, imageKey, timestamp, imageBuffer.length]
    );

    console.log(`Data stored for ${city} at ${timestamp}`);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Data uploaded successfully',
        imageKey,
        timestamp
      })
    };
  } catch (error) {
    console.error('Error uploading data:', {
      message: error.message,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to upload data',
        details: error.message 
      })
    };
  } finally {
    try {
      await dbClient.end();
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
};
