#!/usr/bin/env python3
"""
Create test recordings for mass management testing
"""

import requests
import json
from datetime import datetime, timedelta
import uuid

def create_test_recording(camera_id, camera_name, start_time, recording_type="continuous"):
    """Create a test recording via direct database insertion simulation"""
    
    # Create a mock recording data
    recording_data = {
        "id": str(uuid.uuid4()),
        "camera_id": camera_id,
        "camera_name": camera_name,
        "start_time": start_time.isoformat(),
        "end_time": (start_time + timedelta(minutes=10)).isoformat(),
        "recording_type": recording_type,
        "file_path": f"/app/backend/recordings/{camera_id}/test_{start_time.strftime('%Y%m%d_%H%M%S')}.mp4",
        "file_size": 1024000,  # 1MB
        "duration": 600.0,  # 10 minutes
        "thumbnail_path": None
    }
    
    return recording_data

def main():
    # Get existing camera
    response = requests.get("https://videosecureai.preview.emergentagent.com/api/cameras")
    cameras = response.json()
    
    if not cameras:
        print("No cameras found")
        return
    
    camera = cameras[0]
    camera_id = camera['id']
    camera_name = camera['name']
    
    print(f"Creating test recordings for camera: {camera_name} ({camera_id})")
    
    # Create recordings for different dates
    base_date = datetime.now()
    
    # Create recordings for today
    for i in range(3):
        start_time = base_date - timedelta(hours=i)
        recording = create_test_recording(camera_id, camera_name, start_time)
        print(f"Would create recording: {recording['id']} at {recording['start_time']}")
    
    # Create recordings for yesterday  
    yesterday = base_date - timedelta(days=1)
    for i in range(2):
        start_time = yesterday - timedelta(hours=i)
        recording = create_test_recording(camera_id, camera_name, start_time)
        print(f"Would create recording: {recording['id']} at {recording['start_time']}")
    
    print("\nNote: This script shows what recordings would be created.")
    print("In a real scenario, these would be inserted directly into MongoDB.")
    print("For testing purposes, we'll use the existing API endpoints.")

if __name__ == "__main__":
    main()