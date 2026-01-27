-- Weather Archive Database Schema
-- This script initializes the database with required tables

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cities table: stores available cities for autocomplete
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather data table: stores weather measurements
CREATE TABLE IF NOT EXISTS weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    air_pressure DECIMAL(7,2) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Picture metadata table: stores information about uploaded images
CREATE TABLE IF NOT EXISTS picture_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    raw_image_path VARCHAR(500) NOT NULL,
    compressed_image_path VARCHAR(500),
    timestamp TIMESTAMP NOT NULL,
    file_size_bytes INTEGER,
    compressed_size_bytes INTEGER,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Videos table: stores information about generated timelapse videos
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    video_path VARCHAR(500) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    frame_count INTEGER,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);