from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import asyncio
import cv2
import av
import numpy as np
import aiofiles
import psutil
import json
from threading import Thread, Event
import time
import shutil
import requests
from PIL import Image
from io import BytesIO
from collections import deque
import concurrent.futures

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create a global executor for running async tasks
executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

# Helper function to run async code from thread
def run_async_in_executor(coro):
    """Run async coroutine in a separate thread with its own event loop"""
    def run_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    
    future = executor.submit(run_in_thread)
    try:
        return future.result(timeout=10)  # Wait up to 10 seconds
    except Exception as e:
        logger.error(f"Error running async in executor: {e}")
        return None

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Storage configuration
STORAGE_PATH = Path("/app/backend/recordings")
STORAGE_PATH.mkdir(exist_ok=True)
MAX_STORAGE_GB = 50  # Maximum storage in GB
RETENTION_DAYS = 30  # Keep recordings for 30 days

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Global camera recorders dictionary
active_recorders = {}

# Define Models
class Camera(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    stream_url: str  # Can be RTSP or HTTP URL
    stream_type: str = "rtsp"  # rtsp, http-mjpeg, http-snapshot
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = "tcp"  # tcp or udp (for RTSP only)
    snapshot_interval: float = 1.0  # seconds (for http-snapshot only)
    continuous_recording: bool = True
    motion_detection: bool = True
    motion_sensitivity: float = 0.5  # 0.0 to 1.0
    detection_zones: List[Dict[str, Any]] = []  # List of polygons
    # Motion detection recording settings
    pre_recording_seconds: float = 5.0  # Buffer before motion
    post_recording_seconds: float = 5.0  # Continue recording after motion
    motion_cooldown_seconds: float = 2.0  # Gap between motion events
    # Advanced motion detection settings
    motion_algorithm: str = "mog2"  # "basic", "mog2", "knn"
    min_object_area: int = 500  # Minimum area in pixels to consider as motion
    blur_size: int = 21  # GaussianBlur kernel size (must be odd)
    motion_threshold: int = 25  # Threshold for frame differencing (basic mode)
    mog2_history: int = 500  # Number of frames for MOG2 learning
    mog2_var_threshold: int = 16  # MOG2 threshold for foreground detection
    detect_shadows: bool = True  # Detect and ignore shadows (MOG2 only)
    # Telegram notifications
    telegram_send_notification: bool = False  # Send text notification
    telegram_send_video: bool = False  # Send video file
    status: str = "inactive"  # active, inactive, error
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CameraCreate(BaseModel):
    name: str
    stream_url: str
    stream_type: str = "rtsp"
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = "tcp"
    snapshot_interval: float = 1.0
    continuous_recording: bool = True
    motion_detection: bool = True
    motion_sensitivity: float = 0.5
    detection_zones: List[Dict[str, Any]] = []
    pre_recording_seconds: float = 5.0
    post_recording_seconds: float = 5.0
    motion_cooldown_seconds: float = 2.0
    telegram_send_notification: bool = False
    telegram_send_video: bool = False
    motion_algorithm: str = "mog2"
    min_object_area: int = 500
    blur_size: int = 21
    motion_threshold: int = 25
    mog2_history: int = 500
    mog2_var_threshold: int = 16
    detect_shadows: bool = True

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    stream_type: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: Optional[str] = None
    snapshot_interval: Optional[float] = None
    continuous_recording: Optional[bool] = None
    motion_detection: Optional[bool] = None
    motion_sensitivity: Optional[float] = None
    detection_zones: Optional[List[Dict[str, Any]]] = None
    pre_recording_seconds: Optional[float] = None
    post_recording_seconds: Optional[float] = None
    motion_cooldown_seconds: Optional[float] = None
    telegram_send_notification: Optional[bool] = None
    telegram_send_video: Optional[bool] = None
    motion_algorithm: Optional[str] = None
    min_object_area: Optional[int] = None
    blur_size: Optional[int] = None
    motion_threshold: Optional[int] = None
    mog2_history: Optional[int] = None
    mog2_var_threshold: Optional[int] = None
    detect_shadows: Optional[bool] = None

class Recording(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str
    camera_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    recording_type: str  # continuous or motion
    file_path: str
    file_size: int = 0
    duration: float = 0.0
    thumbnail_path: Optional[str] = None

class MotionEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str
    camera_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    snapshot_path: Optional[str] = None
    recording_id: Optional[str] = None

class StorageStats(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    recordings_count: int
    recordings_size_gb: float

class FFmpegSettings(BaseModel):
    preset: str = "ultrafast"  # ultrafast, superfast, veryfast, faster, fast, medium
    crf: int = 30  # 18-35, lower = better quality
    max_resolution: str = "720p"  # 480p, 720p, 1080p, original
    target_fps: int = 0  # 0 = original, or specify: 10, 15, 20, 24, 30
    audio_bitrate: str = "64k"  # 32k, 64k, 128k
    threads: int = 2  # 1, 2, 4, auto
    enabled: bool = True

class TelegramSettings(BaseModel):
    enabled: bool = False
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    send_motion_alerts: bool = True
    send_error_alerts: bool = True

class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default="system_settings")  # Singleton
    ffmpeg: FFmpegSettings = Field(default_factory=FFmpegSettings)
    telegram: TelegramSettings = Field(default_factory=TelegramSettings)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Telegram helper functions
def send_telegram_notification_sync(camera_name: str, timestamp: datetime, video_path: str = None):
    """Send notification and/or video to Telegram (sync version for threads)"""
    try:
        # Use pymongo sync client to get settings
        from pymongo import MongoClient
        
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.getenv('DB_NAME', 'video_surveillance')
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[db_name]
        
        settings = sync_db.settings.find_one({"id": "system_settings"}, {"_id": 0})
        sync_client.close()
        
        if not settings or not settings.get('telegram', {}).get('enabled'):
            logger.debug("Telegram not enabled, skipping notification")
            return
        
        telegram = settings['telegram']
        bot_token = telegram.get('bot_token')
        chat_id = telegram.get('chat_id')
        
        if not bot_token or not chat_id:
            logger.debug("Telegram credentials not configured, skipping notification")
            return
        
        # Format message
        time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
        message = f"Движение - {time_str} - {camera_name}"
        
        # Send video if path provided
        if video_path and os.path.exists(video_path):
            try:
                url = f"https://api.telegram.org/bot{bot_token}/sendVideo"
                
                with open(video_path, 'rb') as video_file:
                    files = {'video': video_file}
                    data = {
                        'chat_id': chat_id,
                        'caption': message
                    }
                    
                    response = requests.post(url, data=data, files=files, timeout=60)
                    
                    if response.status_code == 200:
                        logger.info(f"✅ Video sent to Telegram: {camera_name}")
                    else:
                        logger.error(f"Failed to send video to Telegram: {response.text}")
                        
            except Exception as e:
                logger.error(f"Error sending video to Telegram: {str(e)}")
        else:
            # Send text message only
            try:
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                data = {
                    'chat_id': chat_id,
                    'text': message
                }
                
                response = requests.post(url, json=data, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"✅ Notification sent to Telegram: {camera_name}")
                else:
                    logger.error(f"Failed to send notification to Telegram: {response.text}")
                    
            except Exception as e:
                logger.error(f"Error sending notification to Telegram: {str(e)}")
                
    except Exception as e:
        logger.error(f"Error in send_telegram_notification_sync: {str(e)}")

# Camera Recorder Class
class CameraRecorder:
    def __init__(self, camera: Camera):
        self.camera = camera
        self.stop_event = Event()
        self.recording_thread = None
        self.current_recording = None
        self.last_frame = None
        
        # Motion detection with pre/post recording
        self.pre_record_buffer = deque()  # Circular buffer for pre-recording
        self.motion_writer = None
        self.motion_file_path = None
        self.motion_state = "idle"  # idle, recording, cooldown
        self.last_motion_time = None
        self.motion_start_time = None
        self.motion_start_time_dt = None  # For Telegram notification
        self.motion_end_time = None
        
        # Error handling and reconnection
        self.error_count = 0
        self.max_errors = 10  # Stop after 10 consecutive errors
        self.reconnect_delay = 5  # Start with 5 seconds
        self.max_reconnect_delay = 300  # Max 5 minutes
        
        # Performance optimization
        self.frame_skip = 2  # Process every Nth frame for motion detection
        self.frame_counter = 0
        
        # H.264 conversion settings
        self.enable_h264_conversion = True  # Set to False to disable conversion
        self.conversion_queue = []  # Queue for async conversion
        
        # Advanced motion detection
        self.bg_subtractor = None
        self.motion_buffer = deque(maxlen=5)  # Temporal filtering
        self._init_motion_detector()
        
    def build_stream_url(self):
        """Build stream URL with authentication"""
        stream_url = self.camera.stream_url
        
        # For RTSP, inject credentials if provided
        if self.camera.stream_type == "rtsp":
            if self.camera.username and self.camera.password:
                if '://' in stream_url:
                    protocol, rest = stream_url.split('://', 1)
                    stream_url = f"{protocol}://{self.camera.username}:{self.camera.password}@{rest}"
            
            # Add protocol option
            if '?' in stream_url:
                stream_url += f"&rtsp_transport={self.camera.protocol}"
            else:
                stream_url += f"?rtsp_transport={self.camera.protocol}"
        
        return stream_url
    
    def start(self):
        """Start recording thread"""
        if self.recording_thread and self.recording_thread.is_alive():
            return
        
        self.stop_event.clear()
        self.recording_thread = Thread(target=self._record_loop, daemon=True)
        self.recording_thread.start()
    
    def stop(self):
        """Stop recording thread"""
        self.stop_event.set()
        if self.recording_thread:
            self.recording_thread.join(timeout=5)
    
    def _get_http_mjpeg_frame(self, stream):
        """Extract frame from MJPEG stream"""
        bytes_data = bytes()
        for chunk in stream.iter_content(chunk_size=1024):
            bytes_data += chunk
            a = bytes_data.find(b'\xff\xd8')  # JPEG start
            b = bytes_data.find(b'\xff\xd9')  # JPEG end
            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]
                
                # Decode JPEG to numpy array
                img = Image.open(BytesIO(jpg))
                frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                return frame
        return None
    
    def _get_http_snapshot(self, url, auth=None):
        """Get single snapshot from HTTP URL"""
        try:
            response = requests.get(url, auth=auth, timeout=5)
            if response.status_code == 200:
                img = Image.open(BytesIO(response.content))
                frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                return frame
        except Exception as e:
            logger.error(f"Error getting HTTP snapshot: {str(e)}")
        return None
    
    def _record_loop(self):
        """Main recording loop with smart reconnection"""
        while not self.stop_event.is_set():
            try:
                success = False
                
                if self.camera.stream_type == "rtsp":
                    success = self._record_rtsp()
                elif self.camera.stream_type == "http-mjpeg":
                    success = self._record_http_mjpeg()
                elif self.camera.stream_type == "http-snapshot":
                    success = self._record_http_snapshot()
                else:
                    logger.error(f"Unknown stream type: {self.camera.stream_type}")
                    time.sleep(5)
                    continue
                
                if success:
                    # Reset error count on success
                    self.error_count = 0
                    self.reconnect_delay = 5
                else:
                    # Increment error count
                    self.error_count += 1
                    
                    # Check if exceeded max errors
                    if self.error_count >= self.max_errors:
                        logger.error(f"Camera {self.camera.name} exceeded max errors ({self.max_errors}). Stopping recorder.")
                        break
                    
                    # Exponential backoff with jitter
                    delay = min(self.reconnect_delay * (2 ** (self.error_count - 1)), self.max_reconnect_delay)
                    jitter = delay * 0.1  # 10% jitter
                    actual_delay = delay + (jitter * (2 * (time.time() % 1) - 1))
                    
                    logger.warning(f"Camera {self.camera.name} connection failed (attempt {self.error_count}/{self.max_errors}). "
                                 f"Retrying in {actual_delay:.1f} seconds...")
                    time.sleep(actual_delay)
                    
            except Exception as e:
                logger.error(f"Error in recording loop for camera {self.camera.name}: {str(e)}")
                self.error_count += 1
                
                if self.error_count >= self.max_errors:
                    logger.error(f"Camera {self.camera.name} exceeded max errors. Stopping recorder.")
                    break
                
                time.sleep(5)
    
    def _record_rtsp(self):
        """Record from RTSP stream"""
        stream_url = self.build_stream_url()
        cap = cv2.VideoCapture(stream_url)
        
        if not cap.isOpened():
            logger.error(f"Failed to open RTSP stream for camera {self.camera.name}")
            return False
        
        try:
            self._process_frames(cap, source_type="rtsp")
            return True
        except Exception as e:
            logger.error(f"Error in RTSP recording: {str(e)}")
            return False
        finally:
            cap.release()
    
    def _record_http_mjpeg(self):
        """Record from HTTP MJPEG stream with pre/post recording"""
        stream_url = self.build_stream_url()
        auth = None
        if self.camera.username and self.camera.password:
            auth = (self.camera.username, self.camera.password)
        
        try:
            stream = requests.get(stream_url, auth=auth, stream=True, timeout=10)
            
            if stream.status_code != 200:
                logger.error(f"HTTP MJPEG stream returned status {stream.status_code}")
                return False
            
            fps = 20  # Assume 20 fps for HTTP streams
            width, height = None, None
            
            pre_buffer_frames = int(fps * self.camera.pre_recording_seconds)
            post_buffer_frames = int(fps * self.camera.post_recording_seconds)
            cooldown_frames = int(fps * self.camera.motion_cooldown_seconds)
            
            continuous_writer = None
            frame_count = 0
            frames_since_motion = 0
            
            while not self.stop_event.is_set():
                frame = self._get_http_mjpeg_frame(stream)
                
                if frame is None:
                    break
                
                # Initialize dimensions on first frame
                if width is None:
                    height, width = frame.shape[:2]
                    
                    if self.camera.continuous_recording:
                        continuous_file = self._create_recording_file("continuous")
                        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                        continuous_writer = cv2.VideoWriter(continuous_file, fourcc, fps, (width, height))
                        self.current_recording = continuous_file
                
                # Continuous recording
                if continuous_writer:
                    continuous_writer.write(frame)
                
                # Motion detection with pre/post recording
                if self.camera.motion_detection:
                    self.pre_record_buffer.append(frame.copy())
                    if len(self.pre_record_buffer) > pre_buffer_frames:
                        self.pre_record_buffer.popleft()
                    
                    motion_detected = self._detect_motion(frame)
                    
                    if motion_detected:
                        self.last_motion_time = time.time()
                        frames_since_motion = 0
                        
                        if self.motion_state == "idle":
                            self._start_motion_recording(fps, width, height)
                            for buffered_frame in self.pre_record_buffer:
                                if self.motion_writer:
                                    self.motion_writer.write(buffered_frame)
                            self._save_motion_event_sync(frame)
                            self.motion_state = "recording"
                        
                        elif self.motion_state == "cooldown":
                            self._start_motion_recording(fps, width, height)
                            self.motion_state = "recording"
                        
                        if self.motion_writer and self.motion_state == "recording":
                            self.motion_writer.write(frame)
                    else:
                        frames_since_motion += 1
                        
                        if self.motion_state == "recording":
                            if frames_since_motion <= post_buffer_frames:
                                if self.motion_writer:
                                    self.motion_writer.write(frame)
                            else:
                                self._stop_motion_recording()
                                self.motion_state = "cooldown"
                        elif self.motion_state == "cooldown":
                            if frames_since_motion > cooldown_frames:
                                self.motion_state = "idle"
                
                frame_count += 1
                
                # Rotate continuous recording every 10 minutes
                if continuous_writer and frame_count >= fps * 600:
                    continuous_writer.release()
                    
                    if self.enable_h264_conversion:
                        import threading
                        old_recording = self.current_recording
                        threading.Thread(
                            target=self._convert_to_h264_async,
                            args=(old_recording,),
                            daemon=True
                        ).start()
                    
                    self._save_recording_metadata_sync(self.current_recording, "continuous")
                    
                    continuous_file = self._create_recording_file("continuous")
                    continuous_writer = cv2.VideoWriter(continuous_file, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
                    self.current_recording = continuous_file
                    frame_count = 0
            
            # Cleanup
            if continuous_writer:
                continuous_writer.release()
                
                if self.enable_h264_conversion:
                    import threading
                    threading.Thread(
                        target=self._convert_to_h264_async,
                        args=(self.current_recording,),
                        daemon=True
                    ).start()
                
                self._save_recording_metadata_sync(self.current_recording, "continuous")
            
            if self.motion_writer:
                self._stop_motion_recording()
            
            return True
            
        except Exception as e:
            logger.error(f"Error in HTTP MJPEG recording: {str(e)}")
            return False
    
    def _record_http_snapshot(self):
        """Record from HTTP snapshot URL with pre/post recording"""
        stream_url = self.build_stream_url()
        auth = None
        if self.camera.username and self.camera.password:
            auth = (self.camera.username, self.camera.password)
        
        fps = int(1.0 / self.camera.snapshot_interval)
        width, height = None, None
        
        pre_buffer_frames = int(fps * self.camera.pre_recording_seconds)
        post_buffer_frames = int(fps * self.camera.post_recording_seconds)
        cooldown_frames = int(fps * self.camera.motion_cooldown_seconds)
        
        continuous_writer = None
        frame_count = 0
        frames_since_motion = 0
        
        while not self.stop_event.is_set():
            frame = self._get_http_snapshot(stream_url, auth)
            
            if frame is None:
                time.sleep(self.camera.snapshot_interval)
                continue
            
            # Initialize dimensions on first frame
            if width is None:
                height, width = frame.shape[:2]
                
                if self.camera.continuous_recording:
                    continuous_file = self._create_recording_file("continuous")
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                    continuous_writer = cv2.VideoWriter(continuous_file, fourcc, fps, (width, height))
                    self.current_recording = continuous_file
            
            # Continuous recording
            if continuous_writer:
                continuous_writer.write(frame)
            
            # Motion detection with pre/post recording
            if self.camera.motion_detection:
                self.pre_record_buffer.append(frame.copy())
                if len(self.pre_record_buffer) > pre_buffer_frames:
                    self.pre_record_buffer.popleft()
                
                motion_detected = self._detect_motion(frame)
                
                if motion_detected:
                    self.last_motion_time = time.time()
                    frames_since_motion = 0
                    
                    if self.motion_state == "idle":
                        self._start_motion_recording(fps, width, height)
                        for buffered_frame in self.pre_record_buffer:
                            if self.motion_writer:
                                self.motion_writer.write(buffered_frame)
                        self._save_motion_event_sync(frame)
                        self.motion_state = "recording"
                    
                    elif self.motion_state == "cooldown":
                        self._start_motion_recording(fps, width, height)
                        self.motion_state = "recording"
                    
                    if self.motion_writer and self.motion_state == "recording":
                        self.motion_writer.write(frame)
                else:
                    frames_since_motion += 1
                    
                    if self.motion_state == "recording":
                        if frames_since_motion <= post_buffer_frames:
                            if self.motion_writer:
                                self.motion_writer.write(frame)
                        else:
                            self._stop_motion_recording()
                            self.motion_state = "cooldown"
                    elif self.motion_state == "cooldown":
                        if frames_since_motion > cooldown_frames:
                            self.motion_state = "idle"
            
            frame_count += 1
            
            # Rotate continuous recording every 10 minutes
            if continuous_writer and frame_count >= fps * 600:
                continuous_writer.release()
                
                if self.enable_h264_conversion:
                    import threading
                    old_recording = self.current_recording
                    threading.Thread(
                        target=self._convert_to_h264_async,
                        args=(old_recording,),
                        daemon=True
                    ).start()
                
                self._save_recording_metadata_sync(self.current_recording, "continuous")
                
                continuous_file = self._create_recording_file("continuous")
                continuous_writer = cv2.VideoWriter(continuous_file, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
                self.current_recording = continuous_file
                frame_count = 0
            
            time.sleep(self.camera.snapshot_interval)
        
        # Cleanup
        if continuous_writer:
            continuous_writer.release()
            
            if self.enable_h264_conversion:
                import threading
                threading.Thread(
                    target=self._convert_to_h264_async,
                    args=(self.current_recording,),
                    daemon=True
                ).start()
            
            self._save_recording_metadata_sync(self.current_recording, "continuous")
        
        if self.motion_writer:
            self._stop_motion_recording()
        
        return True
    
    def _process_frames(self, cap, source_type="rtsp"):
        """Process frames from video capture with pre/post recording buffer"""
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 20
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Calculate buffer size for pre-recording
        pre_buffer_frames = int(fps * self.camera.pre_recording_seconds)
        post_buffer_frames = int(fps * self.camera.post_recording_seconds)
        cooldown_frames = int(fps * self.camera.motion_cooldown_seconds)
        
        continuous_writer = None
        frame_count = 0
        frames_since_motion = 0
        
        if self.camera.continuous_recording:
            continuous_file = self._create_recording_file("continuous")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            continuous_writer = cv2.VideoWriter(continuous_file, fourcc, fps, (width, height))
            self.current_recording = continuous_file
        
        while not self.stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"Failed to read frame from camera {self.camera.name}")
                break
            
            # Continuous recording
            if continuous_writer:
                continuous_writer.write(frame)
            
            # Motion detection with pre/post recording
            if self.camera.motion_detection:
                # Add frame to pre-record buffer
                self.pre_record_buffer.append(frame.copy())
                if len(self.pre_record_buffer) > pre_buffer_frames:
                    self.pre_record_buffer.popleft()
                
                # Detect motion (skip frames for performance)
                motion_detected = False
                self.frame_counter += 1
                if self.frame_counter % self.frame_skip == 0:
                    motion_detected = self._detect_motion(frame)
                elif self.motion_state == "recording":
                    # Always check if we're already recording
                    motion_detected = self._detect_motion(frame)
                
                if motion_detected:
                    self.last_motion_time = time.time()
                    frames_since_motion = 0
                    
                    # Start recording if not already
                    if self.motion_state == "idle":
                        self._start_motion_recording(fps, width, height)
                        # Write pre-recorded frames
                        for buffered_frame in self.pre_record_buffer:
                            if self.motion_writer:
                                self.motion_writer.write(buffered_frame)
                        logger.info(f"Motion detected - wrote {len(self.pre_record_buffer)} pre-recorded frames")
                        
                        # Save motion event
                        self._save_motion_event_sync(frame)
                        self.motion_state = "recording"
                    
                    elif self.motion_state == "cooldown":
                        # Motion resumed during cooldown - restart recording
                        self._start_motion_recording(fps, width, height)
                        self.motion_state = "recording"
                        logger.info("Motion resumed during cooldown - restarted recording")
                    
                    # Always write frame when motion detected and recording
                    if self.motion_writer and self.motion_state == "recording":
                        self.motion_writer.write(frame)
                
                else:
                    # No motion detected
                    frames_since_motion += 1
                    
                    if self.motion_state == "recording":
                        # Continue writing for post-recording period
                        if frames_since_motion <= post_buffer_frames:
                            if self.motion_writer:
                                self.motion_writer.write(frame)
                        else:
                            # End recording and enter cooldown
                            self._stop_motion_recording()
                            self.motion_state = "cooldown"
                            self.motion_end_time = time.time()
                            logger.info(f"Motion ended - post-recording complete")
                    
                    elif self.motion_state == "cooldown":
                        # Wait for cooldown period before accepting new motion
                        if frames_since_motion > cooldown_frames:
                            self.motion_state = "idle"
                            logger.info("Cooldown complete - ready for new motion detection")
            
            frame_count += 1
            
            # Rotate continuous recording every 10 minutes
            if continuous_writer and frame_count >= fps * 600:
                continuous_writer.release()
                
                if self.enable_h264_conversion:
                    # Convert in background
                    import threading
                    old_recording = self.current_recording
                    conversion_thread = threading.Thread(
                        target=self._convert_to_h264_async,
                        args=(old_recording,),
                        daemon=True
                    )
                    conversion_thread.start()
                
                self._save_recording_metadata_sync(self.current_recording, "continuous")
                
                continuous_file = self._create_recording_file("continuous")
                continuous_writer = cv2.VideoWriter(continuous_file, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
                self.current_recording = continuous_file
                frame_count = 0
        
        # Cleanup
        if continuous_writer:
            continuous_writer.release()
            
            if self.enable_h264_conversion:
                import threading
                conversion_thread = threading.Thread(
                    target=self._convert_to_h264_async,
                    args=(self.current_recording,),
                    daemon=True
                )
                conversion_thread.start()
            
            self._save_recording_metadata_sync(self.current_recording, "continuous")
        
        if self.motion_writer:
            self._stop_motion_recording()
    
    def _create_recording_file(self, recording_type: str) -> str:
        """Create a new recording file path"""
        camera_dir = STORAGE_PATH / self.camera.id
        camera_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{recording_type}_{timestamp}.mp4"
        return str(camera_dir / filename)
    
    def _start_motion_recording(self, fps, width, height):
        """Start motion recording with pre-buffer"""
        if self.motion_writer:
            return
        
        self.motion_file_path = self._create_recording_file("motion")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.motion_writer = cv2.VideoWriter(self.motion_file_path, fourcc, fps, (width, height))
        self.motion_start_time = time.time()
        self.motion_start_time_dt = datetime.now(timezone.utc)  # Save datetime for Telegram
        logger.info(f"Started motion recording: {self.motion_file_path}")
    
    def _stop_motion_recording(self):
        """Stop motion recording and save metadata"""
        if not self.motion_writer:
            return
        
        self.motion_writer.release()
        self.motion_writer = None
        
        # Save recording metadata and convert to H.264
        if self.motion_file_path and os.path.exists(self.motion_file_path):
            if self.enable_h264_conversion:
                # Convert to H.264 in background (non-blocking)
                import threading
                conversion_thread = threading.Thread(
                    target=self._convert_to_h264_async,
                    args=(self.motion_file_path,),
                    daemon=True
                )
                conversion_thread.start()
            
            self._save_recording_metadata_sync(self.motion_file_path, "motion")
            logger.info(f"Stopped motion recording: {self.motion_file_path}")
        
        self.motion_file_path = None
    
    def _convert_to_h264_async(self, file_path: str):
        """Convert video to H.264 in background (non-blocking)"""
        try:
            logger.info(f"Starting H.264 conversion in background: {file_path}")
            self._convert_to_h264(file_path)
            
            # Create Telegram video and send if enabled
            if self.camera.telegram_send_video or self.camera.telegram_send_notification:
                telegram_video_path = self._create_telegram_video(file_path)
                
                # Send to Telegram
                if self.camera.telegram_send_video and telegram_video_path:
                    send_telegram_notification_sync(
                        self.camera.name,
                        self.motion_start_time_dt,
                        telegram_video_path
                    )
                    # Clean up telegram video after sending
                    try:
                        if os.path.exists(telegram_video_path):
                            os.remove(telegram_video_path)
                    except:
                        pass
                elif self.camera.telegram_send_notification:
                    # Send notification only
                    send_telegram_notification_sync(
                        self.camera.name,
                        self.motion_start_time_dt,
                        None
                    )
                    
        except Exception as e:
            logger.error(f"Error in async H.264 conversion: {e}")
    
    def _convert_to_h264(self, file_path: str):
        """Convert video to H.264 codec for browser compatibility (uses settings from DB)"""
        try:
            # Get settings from database using sync client
            from pymongo import MongoClient
            mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.getenv('DB_NAME', 'video_surveillance')
            sync_client = MongoClient(mongo_url)
            sync_db = sync_client[db_name]
            settings_doc = sync_db.settings.find_one({"id": "system_settings"}, {"_id": 0})
            sync_client.close()
            
            if settings_doc and settings_doc.get('ffmpeg', {}).get('enabled') == False:
                logger.info(f"H.264 conversion disabled in settings, skipping: {file_path}")
                return
            
            # Extract FFmpeg settings or use defaults
            ffmpeg_settings = settings_doc.get('ffmpeg', {}) if settings_doc else {}
            preset = ffmpeg_settings.get('preset', 'ultrafast')
            crf = ffmpeg_settings.get('crf', 30)
            max_resolution = ffmpeg_settings.get('max_resolution', '720p')
            target_fps = ffmpeg_settings.get('target_fps', 15)
            audio_bitrate = ffmpeg_settings.get('audio_bitrate', '64k')
            threads = ffmpeg_settings.get('threads', 2)
            
            # Convert resolution to dimensions
            resolution_map = {
                '480p': (854, 480),
                '720p': (1280, 720),
                '1080p': (1920, 1080),
                'original': (9999, 9999)
            }
            max_width, max_height = resolution_map.get(max_resolution, (1280, 720))
            
            temp_path = file_path + ".tmp.mp4"
            
            # Build scale filter
            fps_filter = f",fps={target_fps}" if target_fps > 0 else ""
            
            if max_resolution == 'original':
                scale_filter = f"null{fps_filter}" if fps_filter else "null"
            else:
                scale_filter = f"scale='min({max_width},iw)':'min({max_height},ih)':force_original_aspect_ratio=decrease{fps_filter}"
            
            # Build ffmpeg command
            result = os.system(
                f'ffmpeg -i "{file_path}" '
                f'-c:v libx264 -preset {preset} -tune zerolatency -crf {crf} '
                f'-vf "{scale_filter}" '
                f'-c:a aac -b:a {audio_bitrate} '
                f'-movflags +faststart '
                f'-threads {threads} '
                f'"{temp_path}" -y '
                f'> /dev/null 2>&1'
            )
            
            if result == 0 and os.path.exists(temp_path):
                # Get file sizes
                original_size = os.path.getsize(file_path)
                converted_size = os.path.getsize(temp_path)
                compression = (1 - converted_size / original_size) * 100 if original_size > 0 else 0
                
                # Replace original with converted
                os.replace(temp_path, file_path)
                logger.info(f"Converted to H.264: {file_path} (compression: {compression:.1f}%)")
            else:
                logger.warning(f"Failed to convert to H.264: {file_path}, keeping original")
                # Keep original mp4v file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        except Exception as e:
            logger.error(f"Error converting to H.264: {e}")
            # Keep original file
    
    def _create_telegram_video(self, source_video_path: str) -> str:
        """Create low-quality video for Telegram (640x480, 5x speed)"""
        try:
            telegram_video_path = source_video_path.replace('.mp4', '_telegram.mp4')
            
            # Use ffmpeg to create low-quality version with 5x speedup
            # setpts=PTS/5 speeds up video 5x (5 seconds -> 1 second)
            result = os.system(
                f'ffmpeg -i "{source_video_path}" '
                f'-vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,setpts=PTS/5" '
                f'-r 5 '  # Output framerate
                f'-c:v libx264 -preset ultrafast -crf 35 '
                f'-an '  # Remove audio
                f'-movflags +faststart '
                f'"{telegram_video_path}" -y '
                f'> /dev/null 2>&1'
            )
            
            if result == 0 and os.path.exists(telegram_video_path):
                file_size_mb = os.path.getsize(telegram_video_path) / (1024 * 1024)
                
                # Check if file is under 50MB (Telegram limit)
                if file_size_mb > 50:
                    logger.warning(f"Telegram video too large ({file_size_mb:.1f}MB), skipping")
                    os.remove(telegram_video_path)
                    return None
                
                logger.info(f"Created Telegram video: {telegram_video_path} ({file_size_mb:.1f}MB)")
                return telegram_video_path
            else:
                logger.error(f"Failed to create Telegram video")
                return None
                
        except Exception as e:
            logger.error(f"Error creating Telegram video: {e}")
            return None
    
    def _detect_motion(self, frame) -> bool:
        """Detect motion in frame using frame differencing"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self.last_frame is None:
            self.last_frame = gray
            return False
        
        frame_delta = cv2.absdiff(self.last_frame, gray)
        thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        # Apply detection zones if specified
        if self.camera.detection_zones:
            mask = np.zeros(thresh.shape, dtype=np.uint8)
            for zone in self.camera.detection_zones:
                points = np.array([[p['x'], p['y']] for p in zone['points']], dtype=np.int32)
                cv2.fillPoly(mask, [points], 255)
            thresh = cv2.bitwise_and(thresh, mask)
        
        # Calculate motion percentage
        motion_pixels = np.sum(thresh > 0)
        total_pixels = thresh.shape[0] * thresh.shape[1]
        motion_percentage = motion_pixels / total_pixels
        
        # Adjust sensitivity threshold
        threshold = 0.01 + (1 - self.camera.motion_sensitivity) * 0.09  # 0.01 to 0.1
        
        self.last_frame = gray
        return motion_percentage > threshold
    
    def _save_motion_event_sync(self, frame):
        """Save motion event to database (sync version for thread)"""
        try:
            # Save snapshot
            snapshot_dir = STORAGE_PATH / self.camera.id / "snapshots"
            snapshot_dir.mkdir(exist_ok=True, parents=True)
            
            timestamp_dt = datetime.now(timezone.utc)
            timestamp = timestamp_dt.strftime("%Y%m%d_%H%M%S")
            snapshot_path = str(snapshot_dir / f"motion_{timestamp}.jpg")
            cv2.imwrite(snapshot_path, frame)
            
            # Save to MongoDB using sync client
            from pymongo import MongoClient
            mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.getenv('DB_NAME', 'video_surveillance')
            sync_client = MongoClient(mongo_url)
            sync_db = sync_client[db_name]
            
            event_doc = {
                "id": str(uuid.uuid4()),
                "camera_id": self.camera.id,
                "camera_name": self.camera.name,
                "timestamp": timestamp_dt.isoformat(),
                "snapshot_path": snapshot_path
            }
            
            sync_db.motion_events.insert_one(event_doc)
            sync_client.close()
            
            logger.info(f"Motion event saved: {snapshot_path}")
            
        except Exception as e:
            logger.error(f"Error saving motion event: {str(e)}")
    
    def _save_recording_metadata_sync(self, file_path: str, recording_type: str):
        """Save recording metadata (sync version for thread)"""
        try:
            if not os.path.exists(file_path):
                return
            
            file_size = os.path.getsize(file_path)
            
            # Get video duration
            cap = cv2.VideoCapture(file_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            duration = frame_count / fps if fps > 0 else 0
            cap.release()
            
            # Save to MongoDB using sync client
            from pymongo import MongoClient
            mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.getenv('DB_NAME', 'video_surveillance')
            sync_client = MongoClient(mongo_url)
            sync_db = sync_client[db_name]
            
            recording_doc = {
                "id": str(uuid.uuid4()),
                "camera_id": self.camera.id,
                "camera_name": self.camera.name,
                "start_time": datetime.now(timezone.utc).isoformat(),
                "recording_type": recording_type,
                "file_path": file_path,
                "file_size": file_size,
                "duration": duration
            }
            
            sync_db.recordings.insert_one(recording_doc)
            sync_client.close()
            
            logger.info(f"Recording saved to DB: {file_path}, duration: {duration:.1f}s, size: {file_size} bytes")
            
        except Exception as e:
            logger.error(f"Error saving recording metadata: {str(e)}")

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Video Surveillance System API"}

@api_router.get("/test-player")
async def test_player():
    from fastapi.responses import HTMLResponse
    with open("/app/backend/test_video_player.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# Camera Management
@api_router.post("/cameras", response_model=Camera)
async def create_camera(camera_input: CameraCreate, background_tasks: BackgroundTasks):
    camera_dict = camera_input.model_dump()
    camera = Camera(**camera_dict)
    
    doc = camera.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.cameras.insert_one(doc)
    
    # Start recorder
    recorder = CameraRecorder(camera)
    recorder.start()
    active_recorders[camera.id] = recorder
    camera.status = "active"
    
    return camera

@api_router.get("/cameras", response_model=List[Camera])
async def get_cameras():
    cameras = await db.cameras.find({}, {"_id": 0}).to_list(1000)
    
    for cam in cameras:
        if isinstance(cam['created_at'], str):
            cam['created_at'] = datetime.fromisoformat(cam['created_at'])
        
        # Update status based on recorder
        if cam['id'] in active_recorders:
            cam['status'] = 'active'
        else:
            cam['status'] = 'inactive'
    
    return cameras

@api_router.get("/cameras/{camera_id}", response_model=Camera)
async def get_camera(camera_id: str):
    camera = await db.cameras.find_one({"id": camera_id}, {"_id": 0})
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    if isinstance(camera['created_at'], str):
        camera['created_at'] = datetime.fromisoformat(camera['created_at'])
    
    if camera_id in active_recorders:
        camera['status'] = 'active'
    
    return camera

@api_router.put("/cameras/{camera_id}", response_model=Camera)
async def update_camera(camera_id: str, camera_update: CameraUpdate):
    camera = await db.cameras.find_one({"id": camera_id}, {"_id": 0})
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    update_data = camera_update.model_dump(exclude_unset=True)
    
    if update_data:
        await db.cameras.update_one({"id": camera_id}, {"$set": update_data})
        camera.update(update_data)
    
    # Restart recorder with new settings
    if camera_id in active_recorders:
        active_recorders[camera_id].stop()
        del active_recorders[camera_id]
    
    updated_camera = Camera(**camera)
    recorder = CameraRecorder(updated_camera)
    recorder.start()
    active_recorders[camera_id] = recorder
    
    if isinstance(camera['created_at'], str):
        camera['created_at'] = datetime.fromisoformat(camera['created_at'])
    
    return camera

@api_router.delete("/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    camera = await db.cameras.find_one({"id": camera_id})
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    # Stop recorder
    if camera_id in active_recorders:
        active_recorders[camera_id].stop()
        del active_recorders[camera_id]
    
    await db.cameras.delete_one({"id": camera_id})
    
    return {"message": "Camera deleted successfully"}

@api_router.post("/cameras/{camera_id}/start")
async def start_camera(camera_id: str):
    camera = await db.cameras.find_one({"id": camera_id}, {"_id": 0})
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    if camera_id not in active_recorders:
        if isinstance(camera['created_at'], str):
            camera['created_at'] = datetime.fromisoformat(camera['created_at'])
        
        cam = Camera(**camera)
        recorder = CameraRecorder(cam)
        recorder.start()
        active_recorders[camera_id] = recorder
    
    return {"message": "Camera started"}

@api_router.post("/cameras/{camera_id}/stop")
async def stop_camera(camera_id: str):
    if camera_id in active_recorders:
        active_recorders[camera_id].stop()
        del active_recorders[camera_id]
    
    return {"message": "Camera stopped"}

# Recordings
@api_router.get("/recordings", response_model=List[Recording])
async def get_recordings(camera_id: Optional[str] = None, recording_type: Optional[str] = None, limit: int = 100):
    query = {}
    if camera_id:
        query['camera_id'] = camera_id
    if recording_type:
        query['recording_type'] = recording_type
    
    recordings = await db.recordings.find(query, {"_id": 0}).sort("start_time", -1).limit(limit).to_list(limit)
    
    for rec in recordings:
        if isinstance(rec['start_time'], str):
            rec['start_time'] = datetime.fromisoformat(rec['start_time'])
        if rec.get('end_time') and isinstance(rec['end_time'], str):
            rec['end_time'] = datetime.fromisoformat(rec['end_time'])
    
    return recordings

@api_router.get("/recordings/{recording_id}")
async def get_recording_file(recording_id: str, request: Request):
    recording = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
    
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    file_path = recording['file_path']
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Recording file not found")
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Check for Range header (for video streaming)
    range_header = request.headers.get("range")
    
    if range_header:
        # Parse range header
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Ensure end doesn't exceed file size
        end = min(end, file_size - 1)
        chunk_size = end - start + 1
        
        # Stream the requested range
        def iterfile():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    chunk = f.read(min(8192, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": "video/mp4",
        }
        
        return StreamingResponse(iterfile(), status_code=206, headers=headers)
    
    # No range requested, return full file
    return FileResponse(file_path, media_type="video/mp4", filename=os.path.basename(file_path))

@api_router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str):
    recording = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
    
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    # Delete file
    file_path = recording['file_path']
    if os.path.exists(file_path):
        os.remove(file_path)
    
    await db.recordings.delete_one({"id": recording_id})
    
    return {"message": "Recording deleted successfully"}

# Motion Events
@api_router.get("/motion-events", response_model=List[MotionEvent])
async def get_motion_events(camera_id: Optional[str] = None, limit: int = 100):
    query = {}
    if camera_id:
        query['camera_id'] = camera_id
    
    events = await db.motion_events.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for event in events:
        if isinstance(event['timestamp'], str):
            event['timestamp'] = datetime.fromisoformat(event['timestamp'])
    
    return events

@api_router.get("/motion-events/{event_id}/snapshot")
async def get_motion_snapshot(event_id: str):
    event = await db.motion_events.find_one({"id": event_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Motion event not found")
    
    snapshot_path = event.get('snapshot_path')
    if not snapshot_path or not os.path.exists(snapshot_path):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    return FileResponse(snapshot_path, media_type="image/jpeg")

# Storage Management
@api_router.get("/storage/stats", response_model=StorageStats)
async def get_storage_stats():
    # Get disk usage
    disk = psutil.disk_usage(str(STORAGE_PATH))
    
    # Get recordings count and size
    recordings = await db.recordings.find({}, {"_id": 0, "file_size": 1}).to_list(10000)
    recordings_size = sum(r.get('file_size', 0) for r in recordings)
    
    return StorageStats(
        total_gb=disk.total / (1024**3),
        used_gb=disk.used / (1024**3),
        available_gb=disk.free / (1024**3),
        recordings_count=len(recordings),
        recordings_size_gb=recordings_size / (1024**3)
    )

@api_router.post("/storage/cleanup")
async def cleanup_storage():
    """Clean up old recordings based on retention policy"""
    cutoff_date = datetime.now(timezone.utc).timestamp() - (RETENTION_DAYS * 24 * 60 * 60)
    
    recordings = await db.recordings.find({}, {"_id": 0}).to_list(10000)
    deleted_count = 0
    freed_space = 0
    
    for recording in recordings:
        start_time = recording['start_time']
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        
        if start_time.timestamp() < cutoff_date:
            file_path = recording['file_path']
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                os.remove(file_path)
                freed_space += file_size
            
            await db.recordings.delete_one({"id": recording['id']})
            deleted_count += 1
    
    return {
        "deleted_count": deleted_count,
        "freed_space_gb": freed_space / (1024**3)
    }

# Live Stream Endpoint
@api_router.get("/stream/{camera_id}")
async def get_live_stream(camera_id: str):
    camera = await db.cameras.find_one({"id": camera_id}, {"_id": 0})
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    def generate_frames():
        try:
            cam = Camera(**camera)
            if isinstance(cam.created_at, str):
                cam.created_at = datetime.fromisoformat(cam.created_at)
            
            recorder = CameraRecorder(cam)
            
            # Handle different stream types
            if cam.stream_type == "rtsp":
                stream_url = recorder.build_stream_url()
                cap = cv2.VideoCapture(stream_url)
                
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    frame_bytes = buffer.tobytes()
                    
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                
                cap.release()
                
            elif cam.stream_type == "http-mjpeg":
                stream_url = recorder.build_stream_url()
                auth = None
                if cam.username and cam.password:
                    auth = (cam.username, cam.password)
                
                stream = requests.get(stream_url, auth=auth, stream=True, timeout=10)
                
                bytes_data = bytes()
                for chunk in stream.iter_content(chunk_size=1024):
                    bytes_data += chunk
                    a = bytes_data.find(b'\xff\xd8')
                    b = bytes_data.find(b'\xff\xd9')
                    if a != -1 and b != -1:
                        jpg = bytes_data[a:b+2]
                        bytes_data = bytes_data[b+2:]
                        
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')
                
            elif cam.stream_type == "http-snapshot":
                stream_url = recorder.build_stream_url()
                auth = None
                if cam.username and cam.password:
                    auth = (cam.username, cam.password)
                
                while True:
                    frame = recorder._get_http_snapshot(stream_url, auth)
                    if frame is not None:
                        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                        frame_bytes = buffer.tobytes()
                        
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    
                    time.sleep(cam.snapshot_interval)
            
        except Exception as e:
            logger.error(f"Error streaming camera {camera_id}: {str(e)}")
    
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

# Settings API
@api_router.get("/settings", response_model=SystemSettings)
async def get_settings():
    """Get system settings"""
    settings = await db.settings.find_one({"id": "system_settings"}, {"_id": 0})
    
    if not settings:
        # Create default settings
        default_settings = SystemSettings()
        await db.settings.insert_one(default_settings.model_dump())
        return default_settings
    
    return SystemSettings(**settings)

@api_router.put("/settings")
async def update_settings(settings: SystemSettings):
    """Update system settings"""
    settings.updated_at = datetime.now(timezone.utc)
    settings_dict = settings.model_dump()
    
    await db.settings.update_one(
        {"id": "system_settings"},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"message": "Settings updated successfully", "settings": settings}

@api_router.post("/settings/test-telegram")
async def test_telegram():
    """Test Telegram notification"""
    settings = await db.settings.find_one({"id": "system_settings"}, {"_id": 0})
    
    if not settings or not settings.get('telegram', {}).get('enabled'):
        raise HTTPException(status_code=400, detail="Telegram not configured")
    
    telegram = settings['telegram']
    
    try:
        import requests
        url = f"https://api.telegram.org/bot{telegram['bot_token']}/sendMessage"
        data = {
            "chat_id": telegram['chat_id'],
            "text": "🔔 Тестовое сообщение от системы видеонаблюдения\n\nНастройка работает корректно!"
        }
        response = requests.post(url, json=data, timeout=10)
        
        if response.status_code == 200:
            return {"success": True, "message": "Сообщение отправлено успешно"}
        else:
            return {"success": False, "message": f"Ошибка: {response.text}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration - Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_origins=["*"],  # Allow all origins
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start all active cameras on startup"""
    # Migrate old cameras to new schema
    cameras = await db.cameras.find({}).to_list(1000)
    
    for camera_doc in cameras:
        needs_update = False
        
        # Migrate rtsp_url to stream_url
        if 'rtsp_url' in camera_doc and 'stream_url' not in camera_doc:
            camera_doc['stream_url'] = camera_doc['rtsp_url']
            needs_update = True
        
        # Add stream_type if missing
        if 'stream_type' not in camera_doc:
            camera_doc['stream_type'] = 'rtsp'
            needs_update = True
        
        # Add snapshot_interval if missing
        if 'snapshot_interval' not in camera_doc:
            camera_doc['snapshot_interval'] = 1.0
            needs_update = True
        
        # Update database if needed
        if needs_update:
            await db.cameras.update_one(
                {'id': camera_doc['id']},
                {'$set': {
                    'stream_url': camera_doc['stream_url'],
                    'stream_type': camera_doc.get('stream_type', 'rtsp'),
                    'snapshot_interval': camera_doc.get('snapshot_interval', 1.0)
                }}
            )
        
        # Start recorder
        if isinstance(camera_doc['created_at'], str):
            camera_doc['created_at'] = datetime.fromisoformat(camera_doc['created_at'])
        
        try:
            camera = Camera(**camera_doc)
            recorder = CameraRecorder(camera)
            recorder.start()
            active_recorders[camera.id] = recorder
            logger.info(f"Started recorder for camera: {camera.name}")
        except Exception as e:
            logger.error(f"Failed to start camera {camera_doc.get('name', 'unknown')}: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop all recorders on shutdown"""
    for recorder in active_recorders.values():
        recorder.stop()
    
    active_recorders.clear()
    client.close()
