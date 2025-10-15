"""
Telegram Bot for Video Surveillance System
Provides camera list and motion video retrieval functionality
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import asyncio

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)
from pymongo import MongoClient

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


class VideoSurveillanceBot:
    def __init__(self, bot_token: str, allowed_chat_id: str, mongo_url: str, db_name: str):
        """Initialize the bot with configuration"""
        self.bot_token = bot_token
        self.allowed_chat_id = str(allowed_chat_id)
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.application = None
        
        # MongoDB connection
        self.mongo_client = MongoClient(mongo_url)
        self.db = self.mongo_client[db_name]
        
        logger.info(f"Bot initialized for chat_id: {self.allowed_chat_id}")
    
    def _check_authorized(self, update: Update) -> bool:
        """Check if user is authorized to use the bot"""
        chat_id = str(update.effective_chat.id)
        if chat_id != self.allowed_chat_id:
            logger.warning(f"Unauthorized access attempt from chat_id: {chat_id}")
            return False
        return True
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command - show main menu"""
        chat_id = str(update.effective_chat.id)
        logger.info(f"Received /start from chat_id: {chat_id}, allowed: {self.allowed_chat_id}")
        
        if not self._check_authorized(update):
            await update.message.reply_text("⛔ У вас нет доступа к этому боту.")
            return
        
        keyboard = [
            [InlineKeyboardButton("📹 Список камер", callback_data="cameras_list")],
            [InlineKeyboardButton("🎥 Видео по движению", callback_data="videos_menu")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "🎬 *Система видеонаблюдения*\n\n"
            "Выберите действие:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
    
    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle button callbacks"""
        query = update.callback_query
        await query.answer()
        
        if not self._check_authorized(update):
            await query.edit_message_text("⛔ У вас нет доступа к этому боту.")
            return
        
        data = query.data
        
        if data == "cameras_list":
            await self.show_cameras_list(query)
        
        elif data == "videos_menu":
            await self.show_camera_selection_for_videos(query)
        
        elif data.startswith("select_camera_"):
            camera_id = data.replace("select_camera_", "")
            await self.show_time_interval_selection(query, camera_id)
        
        elif data.startswith("videos_"):
            # Format: videos_cameraId_interval
            parts = data.split("_")
            if len(parts) == 3:
                camera_id = parts[1]
                interval = parts[2]
                await self.send_videos(query, camera_id, interval)
        
        elif data == "back_main":
            await self.show_main_menu(query)
        
        elif data == "back_videos":
            await self.show_camera_selection_for_videos(query)
    
    async def show_cameras_list(self, query):
        """Show list of all cameras"""
        try:
            cameras = list(self.db.cameras.find({}, {"_id": 0}))
            
            if not cameras:
                await query.edit_message_text(
                    "📹 *Список камер*\n\n"
                    "Камеры не найдены.",
                    parse_mode='Markdown',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Назад", callback_data="back_main")
                    ]])
                )
                return
            
            message = "📹 *Список камер*\n\n"
            for i, camera in enumerate(cameras, 1):
                status = "🟢 Активна" if camera.get('status') == 'active' else "🔴 Неактивна"
                message += f"{i}. *{camera['name']}*\n"
                message += f"   Статус: {status}\n"
                message += f"   Запись: {'✅' if camera.get('continuous_recording') else '❌'}\n"
                message += f"   Детекция движения: {'✅' if camera.get('motion_detection') else '❌'}\n\n"
            
            keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data="back_main")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                message,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error showing cameras list: {e}")
            await query.edit_message_text(
                f"❌ Ошибка при получении списка камер: {str(e)}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Назад", callback_data="back_main")
                ]])
            )
    
    async def show_camera_selection_for_videos(self, query):
        """Show camera selection for video retrieval"""
        try:
            cameras = list(self.db.cameras.find({}, {"_id": 0, "id": 1, "name": 1}))
            
            if not cameras:
                await query.edit_message_text(
                    "🎥 *Видео по движению*\n\n"
                    "Камеры не найдены.",
                    parse_mode='Markdown',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Назад", callback_data="back_main")
                    ]])
                )
                return
            
            keyboard = []
            for camera in cameras:
                keyboard.append([
                    InlineKeyboardButton(
                        f"📹 {camera['name']}", 
                        callback_data=f"select_camera_{camera['id']}"
                    )
                ])
            
            keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back_main")])
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                "🎥 *Видео по движению*\n\n"
                "Выберите камеру:",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error showing camera selection: {e}")
            await query.edit_message_text(
                f"❌ Ошибка: {str(e)}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Назад", callback_data="back_main")
                ]])
            )
    
    async def show_time_interval_selection(self, query, camera_id: str):
        """Show time interval selection for videos"""
        try:
            camera = self.db.cameras.find_one({"id": camera_id}, {"_id": 0, "name": 1})
            camera_name = camera['name'] if camera else "Неизвестная камера"
            
            keyboard = [
                [InlineKeyboardButton("⏱️ Последний час", callback_data=f"videos_{camera_id}_1h")],
                [InlineKeyboardButton("📅 Последние 6 часов", callback_data=f"videos_{camera_id}_6h")],
                [InlineKeyboardButton("📅 Последние 24 часа", callback_data=f"videos_{camera_id}_24h")],
                [InlineKeyboardButton("📅 Последние 7 дней", callback_data=f"videos_{camera_id}_7d")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_videos")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                f"🎥 *Видео по движению*\n\n"
                f"Камера: *{camera_name}*\n\n"
                f"Выберите временной интервал:",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error showing time interval: {e}")
            await query.edit_message_text(
                f"❌ Ошибка: {str(e)}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Назад", callback_data="back_videos")
                ]])
            )
    
    async def send_videos(self, query, camera_id: str, interval: str):
        """Send motion videos for selected camera and time interval"""
        try:
            await query.edit_message_text("⏳ Поиск видео...")
            
            # Calculate time range
            now = datetime.now(timezone.utc)
            if interval == "1h":
                start_time = now - timedelta(hours=1)
                interval_text = "последний час"
            elif interval == "6h":
                start_time = now - timedelta(hours=6)
                interval_text = "последние 6 часов"
            elif interval == "24h":
                start_time = now - timedelta(hours=24)
                interval_text = "последние 24 часа"
            elif interval == "7d":
                start_time = now - timedelta(days=7)
                interval_text = "последние 7 дней"
            else:
                start_time = now - timedelta(hours=1)
                interval_text = "последний час"
            
            # Get camera name
            camera = self.db.cameras.find_one({"id": camera_id}, {"_id": 0, "name": 1})
            camera_name = camera['name'] if camera else "Неизвестная камера"
            
            # Find motion recordings
            recordings = list(self.db.recordings.find({
                "camera_id": camera_id,
                "recording_type": "motion",
                "start_time": {"$gte": start_time.isoformat()}
            }, {"_id": 0}).sort("start_time", -1).limit(10))
            
            if not recordings:
                keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data=f"select_camera_{camera_id}")]]
                await query.edit_message_text(
                    f"🎥 *Видео по движению*\n\n"
                    f"Камера: *{camera_name}*\n"
                    f"Интервал: {interval_text}\n\n"
                    f"❌ Записи не найдены.",
                    reply_markup=InlineKeyboardMarkup(keyboard),
                    parse_mode='Markdown'
                )
                return
            
            await query.edit_message_text(
                f"📤 Найдено {len(recordings)} записей. Конвертирую и отправляю..."
            )
            
            # Import conversion function
            import sys
            sys.path.append('/app/backend')
            from server import CameraRecorder, Camera
            
            # Send each video
            sent_count = 0
            for i, recording in enumerate(recordings, 1):
                try:
                    file_path = recording.get('file_path')
                    if not file_path or not os.path.exists(file_path):
                        logger.warning(f"Video file not found: {file_path}")
                        continue
                    
                    # Create temporary telegram video
                    temp_video = self._convert_video_for_telegram(file_path)
                    
                    if temp_video and os.path.exists(temp_video):
                        # Format timestamp
                        start_time_str = recording.get('start_time', '')
                        if isinstance(start_time_str, str):
                            dt = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                            time_str = dt.strftime('%d.%m.%Y %H:%M:%S')
                        else:
                            time_str = str(start_time_str)
                        
                        caption = (
                            f"🎥 {camera_name}\n"
                            f"📅 {time_str}\n"
                            f"⏱️ {recording.get('duration', 0):.1f}с"
                        )
                        
                        # Send video
                        with open(temp_video, 'rb') as video_file:
                            await query.message.reply_video(
                                video=video_file,
                                caption=caption,
                                supports_streaming=True
                            )
                        
                        # Clean up temp file
                        os.remove(temp_video)
                        sent_count += 1
                        
                        # Add delay to avoid hitting rate limits
                        if i < len(recordings):
                            await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error sending video {i}: {e}")
                    continue
            
            # Send summary
            keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data=f"select_camera_{camera_id}")]]
            await query.message.reply_text(
                f"✅ Отправлено {sent_count} из {len(recordings)} видео.",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error in send_videos: {e}")
            keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data=f"select_camera_{camera_id}")]]
            await query.message.reply_text(
                f"❌ Ошибка при отправке видео: {str(e)}",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
    
    def _convert_video_for_telegram(self, source_path: str) -> Optional[str]:
        """Convert video to Telegram-friendly format (640x480, 5 FPS, 5x speed)"""
        try:
            temp_path = source_path + ".telegram.mp4"
            
            # Use ffmpeg if available, otherwise return original
            result = os.system(
                f'ffmpeg -i "{source_path}" '
                f'-vf "scale=640:480:force_original_aspect_ratio=decrease,setpts=0.2*PTS" '
                f'-r 5 '
                f'-c:v libx264 -preset ultrafast -crf 30 '
                f'-an '
                f'"{temp_path}" -y '
                f'> /dev/null 2>&1'
            )
            
            if result == 0 and os.path.exists(temp_path):
                logger.info(f"Video converted for Telegram: {temp_path}")
                return temp_path
            else:
                logger.warning(f"FFmpeg conversion failed, using original file")
                return source_path
                
        except Exception as e:
            logger.error(f"Error converting video: {e}")
            return source_path
    
    async def show_main_menu(self, query):
        """Show main menu"""
        keyboard = [
            [InlineKeyboardButton("📹 Список камер", callback_data="cameras_list")],
            [InlineKeyboardButton("🎥 Видео по движению", callback_data="videos_menu")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "🎬 *Система видеонаблюдения*\n\n"
            "Выберите действие:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
    
    async def error_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle errors"""
        logger.error(f"Exception while handling an update: {context.error}")
        
        if update and update.effective_message:
            await update.effective_message.reply_text(
                "❌ Произошла ошибка при обработке запроса."
            )
    
    def start(self):
        """Start the bot"""
        # Create new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Create application
            self.application = Application.builder().token(self.bot_token).build()
            
            # Add handlers
            self.application.add_handler(CommandHandler("start", self.start_command))
            self.application.add_handler(CallbackQueryHandler(self.button_callback))
            self.application.add_error_handler(self.error_handler)
            
            # Run bot
            logger.info("Starting Telegram bot...")
            self.application.run_polling(allowed_updates=Update.ALL_TYPES)
        finally:
            loop.close()
    
    def stop(self):
        """Stop the bot"""
        if self.application:
            logger.info("Stopping Telegram bot...")
            self.application.stop()
        
        if self.mongo_client:
            self.mongo_client.close()


# For running as standalone
if __name__ == "__main__":
    import sys
    
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "video_surveillance")
    
    if not bot_token or not chat_id:
        print("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set")
        sys.exit(1)
    
    bot = VideoSurveillanceBot(bot_token, chat_id, mongo_url, db_name)
    bot.start()
