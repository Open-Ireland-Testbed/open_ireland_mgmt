# backend/discord_utils.py
import os
import httpx

BOOKING_WEBHOOK = os.getenv("BOOKING_WEBHOOK", "")
ADMIN_WEBHOOK = os.getenv("ADMIN_WEBHOOK", "")

async def _post_to_webhook(url: str, content: str, allowed_mentions: dict | None = None):
    if not url:
        return

    payload = {"content": content}

    if allowed_mentions is not None:
        payload["allowed_mentions"] = allowed_mentions

    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload, timeout=5.0)

async def send_booking_created_notification(content: str):
    """Used after user /bookings creation."""
    await _post_to_webhook(BOOKING_WEBHOOK, content)

async def send_admin_action_notification(content: str, discord_id: str):
    """Used when admin confirms or rejects a booking."""
    mentions = {
        "users": [discord_id],
        "parse": []   
    }

    await _post_to_webhook(ADMIN_WEBHOOK, content, allowed_mentions=mentions)

