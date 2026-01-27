# AWS SAM Local Development Guide

## Prerequisites

- AWS SAM CLI (`pip install aws-sam-cli`)
- Docker Desktop running
- AWS credentials configured

## Quick Start

```bash
cd infrastructure
docker-compose up -d                                          # Start PostgreSQL
sam build                                                     # Build Lambda functions
sam local start-api --port 3001 --docker-network sam-local    # Start API at http://localhost:3001

# Test
curl http://localhost:3001/health

# Stop
# CTRL+C to stop SAM, then:
docker-compose down
```

## Local Development

### Database (PostgreSQL via Docker)
```bash
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose down -v    # Stop and delete data
```

- Host: localhost:5432
- Database: weather_archive
- User: weather_user
- Password: weather_archive_local
- Auto-initialized with schema + seed data (8 cities, sample weather data)

### SAM Local API
```bash
sam build                                                     # After code changes
sam local start-api --port 3001 --docker-network sam-local    # Start API
sam local invoke HealthFunction                               # Test single function
sam validate                                                  # Validate template.yaml
```

## Deployment to AWS (Learners Lab)

Automatic deployment is not available due to IAM restrictions. Deploy manually:

1. Build: `sam build`
2. Find artifacts: `.aws-sam/build/[FunctionName]/`
3. Upload to Lambda via AWS Console
   - Runtime: Node.js 20.x
   - Handler: `index.handler`
   - Role: `LabRole`
4. Configure API Gateway to match `template.yaml` routes

## Lambda Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| **health** | GET /health | Health check |
| **cities** | GET /cities | City autocomplete |
| **weather-data** | GET /weather/{city} | Weather data retrieval (Redis cached, 1h TTL) |
| **video** | GET /video/{city} | Video URL retrieval (Redis cached, 30min TTL) |
| **data** | POST /data | Webcam upload endpoint |
| **picture-service** | S3 trigger | Image compression (Sharp) |
| **video-service** | Hourly schedule | Video generation (FFmpeg, 1 fps) |

## S3 Bucket Structure

```
weather-archive-s3/
├── frontend/                           # React app (static hosting)
├── weather-archive-raw-images/         # Uploaded images → triggers picture-service
├── weather-archive-processed-images/   # Compressed images
└── weather-archive-videos/             # Generated MP4 videos
```

## Common Issues

| Error | Fix |
|-------|-----|
| `Cannot connect to Docker daemon` | Start Docker Desktop |
| `Unable to locate credentials` | Refresh AWS credentials (expire ~4h): `aws sts get-caller-identity` |
| `Address already in use` | Use different port: `--port 3001` |
