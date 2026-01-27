const { Client } = require('pg');
const { createClient } = require('redis');

// Redis client instance 
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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Support query parameter filtering
  const query = event.queryStringParameters?.query || '';

  // Generate unique cache key from parameters (lowercase for consistency)
  const cacheKey = `cities:${query.toLowerCase() || 'all'}`;
  console.log('Cache key:', cacheKey);

  // Try to get data from Redis cache
  try {
    const redis = await getRedisClient();
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log('Cache HIT - Returning cached cities');
      const cities = JSON.parse(cachedData);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(cities)
      };
    }
    console.log('Cache MISS - Querying database');
  } catch (redisError) {
    console.error('Redis error, falling back to database:', redisError);
  }

  // Create client inside handler with SSL
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false  // Required for AWS RDS
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    let result;
    if (query) {
      result = await client.query(
        'SELECT name FROM cities WHERE LOWER(name) LIKE LOWER($1) ORDER BY name',
        [`%${query}%`]
      );
    } else {
      result = await client.query('SELECT name FROM cities ORDER BY name');
    }

    const cities = result.rows.map(row => row.name);
    console.log(`Found ${cities.length} cities`);

    // Store result in Redis with TTL (24 hours = 86400 seconds)
    try {
      const redis = await getRedisClient();
      await redis.setEx(cacheKey, 86400, JSON.stringify(cities));
      console.log('Cities cached successfully with TTL 86400s');
    } catch (redisError) {
      console.error('Failed to cache result:', redisError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cities)
    };
  } catch (error) {
    console.error('Database error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch cities',
        details: error.message 
      })
    };
  } finally {
    // Always close connection
    try {
      await client.end();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
};
