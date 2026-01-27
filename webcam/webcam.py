#!/usr/bin/env python3
"""
Webcam Simulator for Weather Archive Testing

Usage:
    1. Copy .env.example to .env and configure settings
    2. Run: python webcam.py
"""

import os
import re
import base64
import requests
import argparse
import json
from datetime import datetime
from pathlib import Path
import time
from dotenv import load_dotenv

load_dotenv()

WEBCAM_PICTURES_DIR = Path(__file__).parent / "webcam_pictures"
WEATHER_DATA_DIR = Path(__file__).parent / "weather_data"

def load_weather_data(city):
    """Load weather data from JSON file, returning dict mapping (hour, minute) to weather data."""
    weather_file = WEATHER_DATA_DIR / f"{city.lower()}_weather.json"

    if not weather_file.exists():
        print(f"WARNING: Weather data file not found: {weather_file}")
        return None

    try:
        with open(weather_file, 'r') as f:
            data = json.load(f)

        weather_by_time = {}
        for entry in data['data']:
            timestamp = datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00'))
            hour = timestamp.hour
            minute = timestamp.minute

            weather_by_time[(hour, minute)] = {
                'temperature': entry['temperature'],
                'humidity': entry['humidity'],
                'airPressure': entry['airPressure']
            }

        return weather_by_time

    except Exception as ex:
        print(f"ERROR: Failed to load weather data: {ex}")
        return None

def parse_filename_to_time(filename):
    """Extract time from filename pattern: weather_HHMM.jpg"""
    match = re.match(r'weather_(\d{2})(\d{2})\.jpg', filename)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        return (hour, minute)
    return None

def get_weather_for_time(weather_data, hour, minute):
    """Get weather data for specific time, with default fallback."""
    if weather_data and (hour, minute) in weather_data:
        return weather_data[(hour, minute)]

    print(f"WARNING: No weather data for {hour:02d}:{minute:02d}, using defaults")
    return {"temperature": 15.0, "humidity": 65, "airPressure": 1013}

def upload_image(api_url, city, date, filename, image_path, weather_data, api_key):
    """Upload image to API with timestamp and weather data."""
    time_data = parse_filename_to_time(filename)
    if not time_data:
        print(f"WARNING: Skipping {filename}: Invalid filename format")
        return False

    hour, minute = time_data
    timestamp = f"{date}T{hour:02d}:{minute:02d}:00"
    weather = get_weather_for_time(weather_data, hour, minute)
    try:
        with open(image_path, 'rb') as img_file:
            image_data = base64.b64encode(img_file.read()).decode('utf-8')
    except Exception as e:
        print(f"ERROR: Error reading {filename}: {e}")
        return False

    payload = {
        "city": city,
        "timestamp": timestamp,
        "temperature": weather["temperature"],
        "humidity": weather["humidity"],
        "airPressure": weather["airPressure"],
        "image": f"data:image/jpeg;base64,{image_data}"
    }
    try:
        response = requests.post(
            f"{api_url}/data",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-Api-Key": api_key
            },
            timeout=30
        )
        
        if response.status_code == 201:
            print(f"SUCCESS: {filename} -> {timestamp} (Temp: {weather['temperature']}C, Humidity: {weather['humidity']}% Air Pressure: {weather['airPressure']}hPa)")
            return True
        else:
            print(f"FAILED: {filename} failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"ERROR: Error uploading {filename}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Webcam Simulator for Weather Archive",
        epilog="Note: Command line arguments override .env file settings"
    )
    parser.add_argument(
        "--city",
        default=os.getenv("WEBCAM_CITY"),
        help="City name (e.g., Vienna, Berlin). Defaults to WEBCAM_CITY from .env"
    )
    parser.add_argument(
        "--date",
        default=os.getenv("WEBCAM_DATE"),
        help="Base date for fake timestamps (YYYY-MM-DD). Defaults to WEBCAM_DATE from .env"
    )
    parser.add_argument(
        "--api-url",
        default=os.getenv("API_URL"),
        help="API Gateway base URL. Defaults to API_URL from .env"
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("WEBCAM_API_KEY", "test-api-key-12345"),
        help="API key for authentication. Defaults to WEBCAM_API_KEY from .env"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=float(os.getenv("WEBCAM_DELAY", "0.5")),
        help="Delay between uploads in seconds. Defaults to WEBCAM_DELAY from .env"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("WEBCAM_LIMIT", "0")) or None,
        help="Limit number of images to upload (for testing). Defaults to WEBCAM_LIMIT from .env"
    )

    args = parser.parse_args()

    if not args.city:
        parser.error("--city is required (or set WEBCAM_CITY in .env)")
    if not args.date:
        parser.error("--date is required (or set WEBCAM_DATE in .env)")
    if not args.api_url:
        parser.error("--api-url is required (or set API_URL in .env)")
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("ERROR: Invalid date format. Use YYYY-MM-DD")
        return

    if not WEBCAM_PICTURES_DIR.exists():
        print(f"ERROR: Directory not found: {WEBCAM_PICTURES_DIR}")
        return

    image_files = sorted([f for f in os.listdir(WEBCAM_PICTURES_DIR) if f.endswith('.jpg')])

    if not image_files:
        print(f"ERROR: No .jpg files found in {WEBCAM_PICTURES_DIR}")
        return

    if args.limit:
        image_files = image_files[:args.limit]
    print(f"\nLoading weather data for {args.city}...")
    weather_data = load_weather_data(args.city)

    if not weather_data:
        print("WARNING: Using default weather values\n")
    else:
        print("Successfully loaded weather data\n")

    print("Starting webcam simulation")
    print(f"   City: {args.city}")
    print(f"   Date: {args.date}")
    print(f"   API: {args.api_url}")
    print(f"   Images: {len(image_files)}")
    print(f"   Delay: {args.delay}s\n")

    successful = 0
    failed = 0

    for filename in image_files:
        image_path = WEBCAM_PICTURES_DIR / filename
        success = upload_image(args.api_url, args.city, args.date, filename, image_path, weather_data, args.api_key)

        if success:
            successful += 1
        else:
            failed += 1

        if args.delay > 0:
            time.sleep(args.delay)

    print("\nUpload Summary:")
    print(f"   Successful: {successful}")
    print(f"   Failed: {failed}")
    print(f"   Total: {len(image_files)}\n")

if __name__ == "__main__":
    main()