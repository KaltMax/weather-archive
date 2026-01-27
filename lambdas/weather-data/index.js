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

  const city = event.pathParameters?.city;
  const startDate = event.queryStringParameters?.startDate;
  const endDate = event.queryStringParameters?.endDate;

  if (!city) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'City parameter is required' })
    };
  }

  // Generate unique cache key from parameters
  const cacheKey = `weather:${city}:${startDate || 'all'}:${endDate || 'all'}`;
  console.log('Cache key:', cacheKey);

  try {
    const redis = await getRedisClient();
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log('Cache HIT - Returning cached data');
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

  let sqlQuery = `
    SELECT
      city,
      DATE_TRUNC('hour', timestamp) as timestamp,
      ROUND(AVG(temperature)::numeric, 2) as temperature,
      ROUND(AVG(humidity)::numeric, 2) as humidity,
      ROUND(AVG(air_pressure)::numeric, 2) as "airPressure"
    FROM weather_data
    WHERE city = $1
  `;

  const params = [city];

  if (startDate && endDate) {
    sqlQuery += ` AND timestamp BETWEEN $2 AND $3`;
    params.push(startDate, endDate);
  } else if (startDate) {
    sqlQuery += ` AND timestamp >= $2`;
    params.push(startDate);
  } else if (endDate) {
    sqlQuery += ` AND timestamp <= $2`;
    params.push(endDate);
  }

  sqlQuery += `
    GROUP BY city, DATE_TRUNC('hour', timestamp)
    ORDER BY timestamp ASC
  `;

  try {
    console.log(`Connecting to database for city: ${city}`);
    await client.connect();
    console.log('Connected successfully');
    
    const result = await client.query(sqlQuery, params);
    console.log(`Fetched ${result.rows.length} weather records for ${city}`);
    
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Not Found',
          message: `No weather data available for ${city}`,
        }),
      };
    }

    const responseData = {
      city,
      weatherData: result.rows,
      cached: false
    };

    // Store result in Redis with TTL (1 hour = 3600 seconds)
    try {
      const redis = await getRedisClient();
      const dataToCache = {
        city: responseData.city,
        weatherData: responseData.weatherData
      };
      await redis.setEx(cacheKey, 3600, JSON.stringify(dataToCache));
      console.log('Data cached successfully with TTL 3600s');
    } catch (redisError) {
      console.error('Failed to cache result:', redisError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
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
        error: 'Failed to fetch weather data',
        details: error.message 
      })
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
