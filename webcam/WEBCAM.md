# Webcam Simulator

## Overview

The webcam simulator (`webcam.py`) is a Python script designed to test the Weather Archive system by simulating real webcam POST requests. It uploads weather images with timestamped weather data to the AWS API Gateway endpoint.

## Purpose

This tool is used for:

- **Testing**: Simulating a full day of webcam data uploads without waiting 24 hours
- **Development**: Populating the database with test data for development
- **Demonstrations**: Quickly showcasing the system with "realistic" historical data
- **Multiple Cities**: Testing the system with data from different cities (Vienna, Berlin, Paris)

## How It Works

1. **Image Source**:
  - Uses pre-captured weather images from `webcam_pictures/` directory
  - 288 images covering a full 24-hour period (one every 5 minutes)
  - Images named in format: `weather_HHMM.jpg` (e.g., `weather_0820.jpg` for 08:20)

2. **Timestamp Extraction**:
  - Parses the filename to extract the time (hour and minute)

3. **Weather Data Integration**:
  - Loads weather data from `weather_data/` directory
  - Available cities: Vienna, Berlin, Paris
  - Data includes temperature, humidity, and air pressure for each hour

4. **Data Upload**:
- Sends POST requests to the API Gateway endpoint with:
- Base64-encoded image
  - Timestamp (user-specified date + time from filename)
  - Weather metrics (temperature, humidity, air pressure)
  - City name
  - API key for authentication

## Setup

### 1. Configure Environment Variables

Copy the example environment file and configure your settings.

### 2. Run the Simulator

Once configured, simply run:

```bash
python webcam.py
```

Or override specific settings via command line:

```bash
python webcam.py --city Berlin --date 2025-12-02
```

## Configuration

### Environment Variables (.env file)

| Variable           | Required | Description                           | Example                                                     |
| ------------------ | -------- | ------------------------------------- | ----------------------------------------------------------- |
| `API_URL`        | Yes      | AWS API Gateway base URL              | `https://abc123.execute-api.us-east-1.amazonaws.com/Prod` |
| `WEBCAM_API_KEY` | Yes      | API key for authentication            | `test-api-key-12345`                                      |
| `WEBCAM_CITY`    | Yes      | City name (Vienna, Berlin, or Paris)  | `Vienna`                                                  |
| `WEBCAM_DATE`    | Yes      | Base date for timestamps (YYYY-MM-DD) | `2025-12-01`                                              |
| `WEBCAM_DELAY`   | No       | Delay between uploads in seconds      | `0.5` (default)                                           |
| `WEBCAM_LIMIT`   | No       | Limit number of images to upload      | `0` = all images (default)                                |

### Command Line Arguments

All settings can be overridden via command line arguments:

| Parameter     | Description             | Example                   |
| ------------- | ----------------------- | ------------------------- |
| `--api-url` | Override API_URL        | `--api-url https://...` |
| `--api-key` | Override WEBCAM_API_KEY | `--api-key my-key-123`  |
| `--city`    | Override WEBCAM_CITY    | `--city Berlin`         |
| `--date`    | Override WEBCAM_DATE    | `--date 2025-12-02`     |
| `--delay`   | Override WEBCAM_DELAY   | `--delay 1.0`           |
| `--limit`   | Override WEBCAM_LIMIT   | `--limit 10`            |

**Note:** Command line arguments take precedence over `.env` file settings.

## Usage Examples

**Using .env configuration only:**

```bash
python webcam.py
```

**Override city and date:**

```bash
python webcam.py --city Berlin --date 2025-12-02
```

**Test with 10 images:**

```bash
python webcam.py --limit 10
```

**Upload full day with 1-second delay:**

```bash
python webcam.py --city Paris --delay 1.0
```

**Quick upload with minimal delay:**

```bash
python webcam.py --delay 0.1
```

## Prerequisites

### Python Dependencies

Install required Python packages:

```bash
pip install requests python-dotenv
```

### Required Files

- **Environment Configuration**: `.env` file (copy from `.env.example` and configure)
- **Images**: `webcam_pictures/` directory with weather images (already included)
- **Weather Data**: `weather_data/` directory with city weather JSON files (already included)

## Notes

- The script processes images in sorted order (by filename)
- Upload delay helps avoid overwhelming the API endpoint
- The `--limit` parameter is useful for quick testing without uploading all 288 images
- Each upload is independent; failed uploads don't stop the process
