The Weather Archive
===================

"The Weather Archive" is a web application that allows users to explore historical weather data through an interactive interface. Users can search for specific locations and time periods to view weather conditions, including temperature, humidity, and air pressure. The application features a user-friendly design with a search bar, autocomplete functionality, and detailed visualizations of weather data.

---

# Frontend

The frontend is implemented using React and is hosted on an S3 bucket configured for static website hosting.

- Frontend Documentation: [FRONTEND.md](./frontend/README.md)

---

# Project Overview

## Project Structure

```
  SERVL-Weather-Archive/
  ├── frontend/             # React app (see frontend/README.md)
  ├── infrastructure/       # AWS SAM template, Docker Compose, DB schema
  ├── lambdas/              # 7 AWS Lambda functions
  │   ├── health/           # Health check endpoint
  │   ├── cities/           # City autocomplete
  │   ├── weather-data/     # Weather data retrieval
  │   ├── video/            # Video URL retrieval
  │   ├── data/             # Webcam upload endpoint
  │   ├── picture-service/  # S3-triggered image compression
  │   └── video-service/    # Scheduled video generation
  └── webcam/               # Python webcam simulator
```

## S3 Buckets

### Frontend Static Files

- **Bucket Name**: `weather-archive-s3`
- **Contents**: React app build artifacts (HTML, JS, CSS)

### Raw Webcam Images (Trigger Point)

- **BucketName**: `weather-archive-raw-images`
- **Source**: Uploaded via POST /data endpoint
- **Trigger**: S3 ObjectCreated event -> PictureService Lambda

### Processed Images

- **Bucket Name**: `weather-archive-processed-images`
- **Source**: PictureService Lambda output
- **Format**: JPEG, max 1280x720, 80% quality
- **Used by**: VideoService for creating time-lapse videos

### Generated Videos

- **Bucket Name**: `weather-archive-videos`
- **Source**: VideoService Lambda (scheduled hourly)
- **Format**: MP4 (H.264, 1 fps)

## Database

- **PostgreSQL 18** (local: Docker, production: RDS)
- **Schema**: Simplified without indexes/foreign keys for easier development
- **Seed Data**: 8 cities, 504 weather records (Vienna, Berlin, Paris × 7 days)

### Tables:

- **cities**: City names for autocomplete
  - Fields: id, name, created_at
- **weather_data**: Weather measurements
  - Fields: id (UUID), city, temperature, humidity, air_pressure, timestamp, created_at
- **picture_metadata**: Image tracking and compression status
  - Fields: id (UUID), city, raw_image_path, compressed_image_path, timestamp, file_size_bytes, compressed_size_bytes, is_processed, created_at, processed_at
- **videos**: Generated video metadata
  - Fields: id (UUID), city, video_path, start_date, end_date, frame_count, duration_seconds, created_at

## API Gateway

- **REST API** - exposes Lambda functions to webcams and frontend
  - **Endpoints**:
    - `POST /data` - PostWeatherData Lambda (requires x-api-key header)
    - `GET /weather/{city}` - GetWeatherData Lambda
    - `GET /video/{city}` - GetVideo Lambda
    - `GET /cities` - Autocomplete Lambda

## AWS Lambda Functions

### API Endpoints (via API Gateway)

- **HealthFunction** (GET /health) – Health check
- **AutocompleteFunction** (GET /cities) – City autocomplete for search
- **GetWeatherDataFunction** (GET /weather/{city}) – Retrieves historical weather data
- **GetVideoFunction** (GET /video/{city}) – Retrieves video URL for specific date/hour
- **PostWeatherDataFunction** (POST /data) – Webcam upload endpoint (requires API key)

### Background Services

- **PictureServiceFunction** – S3-triggered image compression (Sharp)
- **VideoServiceFunction** – Scheduled video generation (FFmpeg, runs hourly)

## Redis Cache

- **Provider**: Redis Cloud (Managed Redis service)
- **Cached Endpoints**:
  - **Weather Data** (`/weather/{city}`) - TTL: 1 hour (3600s)
  - **Video URLs** (`/video/{city}`) - TTL: 30 minutes (1800s)
  - **Cities Autocomplete** (`/cities`) - TTL: 24 hours (86400s)
- **Cache Pattern**: Cache-Aside (Read-Through)
  - **Read**: Lambda checks Redis first → if **Cache HIT**, return cached data immediately → If **Cache MISS**, query PostgreSQL → store result in Redis with TTL → return data
  - **Write**: New data uploaded via POST /data is immediately stored in PostgreSQL. Cached data refreshes automatically after TTL expires
- **Connection Reuse**: Redis client persists across Lambda invocations for improved performance
- **Graceful Fallback**: If Redis fails, Lambda falls back to PostgreSQL without errors
- **Benefits**:
  - Reduced database load and faster response times for repeated queries
  - Weather/Video caching optimizes frequently accessed data
  - Cities caching demonstrates scalability pattern (essential for thousands of cities, minimal overhead for current dataset)

## Deployment

### Terraform (Production)

Infrastructure-as-Code deployment for AWS using Terraform:

- **Location**: `infrastructure/terraform/` folder
- **Deploys**: All AWS resources (Lambda, API Gateway, RDS, S3, EventBridge)
- **Usage**:
  1. Configure AWS credentials
  2. Update `terraform.tfvars` with your settings (Redis connection, DB password)
  3. Run `terraform init` to initialize providers
  4. Run `terraform apply` to deploy infrastructure
  5. Use outputs for API endpoint, database connection, and S3 buckets
- **Note**: Lambda dependencies must be installed before deployment (use Docker for native dependencies)

### AWS SAM (Local Development)

See [AWS_SAM.md](./AWS_SAM.md) for detailed instructions on:

- Setting up PostgreSQL with Docker Compose
- Running Lambda functions locally with SAM
- Testing with the webcam simulator

## Webcam Simulator

A Python script that simulates a webcam by periodically sending images and metadata to the API.

- **Location**: `webcam/` folder
- **Usage**: See [WEBCAM.md](./webcam/WEBCAM.md) for setup and execution instructions

## Documentation

- **[Demonstration Guide](./DEMONSTRATION.md)** - Step-by-step demo walkthrough
- **[AWS SAM Guide](./infrastructure/AWS_SAM.md)** - Local development setup
- **[Frontend Documentation](./frontend/README.md)** - React app details
- **[Arc42 Architecture](./docs/arc42.pdf)** - Detailed architecture documentation
