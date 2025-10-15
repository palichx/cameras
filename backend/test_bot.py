#!/usr/bin/env python3
"""
Test script for Telegram bot
Usage: python test_bot.py <bot_token> <chat_id>
"""

import sys
import os

if len(sys.argv) < 3:
    print("Usage: python test_bot.py <bot_token> <chat_id>")
    print("\nExample:")
    print("  python test_bot.py 123456789:ABC... 987654321")
    sys.exit(1)

bot_token = sys.argv[1]
chat_id = sys.argv[2]

# Update settings in database
from pymongo import MongoClient

mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "video_surveillance")

client = MongoClient(mongo_url)
db = client[db_name]

# Update or create settings
result = db.settings.update_one(
    {"id": "system_settings"},
    {
        "$set": {
            "telegram.enabled": True,
            "telegram.bot_token": bot_token,
            "telegram.chat_id": chat_id
        }
    },
    upsert=True
)

print(f"✅ Settings updated (matched: {result.matched_count}, modified: {result.modified_count})")
print(f"   Bot Token: {bot_token[:10]}...")
print(f"   Chat ID: {chat_id}")

# Verify
settings = db.settings.find_one({"id": "system_settings"}, {"_id": 0})
if settings:
    telegram = settings.get('telegram', {})
    print("\n📊 Current settings:")
    print(f"   Enabled: {telegram.get('enabled')}")
    print(f"   Has Token: {bool(telegram.get('bot_token'))}")
    print(f"   Has Chat ID: {bool(telegram.get('chat_id'))}")

client.close()

print("\n🔄 Now restart backend to start the bot:")
print("   sudo supervisorctl restart backend")
print("\n📱 Then send /start to your bot in Telegram")
