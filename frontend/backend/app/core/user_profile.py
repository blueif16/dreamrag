"""
Recompute aggregated user profile from user_dreams and upsert into user_profiles.

Called synchronously after every record_dream. No background jobs, no cron.
"""
import os
import logging
import calendar
from datetime import datetime, timedelta, timezone
from collections import Counter

logger = logging.getLogger(__name__)


def recompute_profile(user_id: str) -> dict:
    """Aggregate all user_dreams for user_id and upsert into user_profiles."""
    from supabase import create_client

    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
    if not supabase_url or not supabase_key:
        logger.warning("[recompute_profile] Supabase env vars not set")
        return {}

    client = create_client(supabase_url, supabase_key)

    # Fetch all dreams for this user
    result = client.table("user_dreams") \
        .select("recorded_at, emotion_tags, symbol_tags") \
        .eq("user_id", user_id) \
        .order("recorded_at", desc=True) \
        .execute()

    dreams = result.data or []
    total_dreams = len(dreams)
    now = datetime.now(timezone.utc)

    # ── Emotion distribution (top 5, as percentages) ──────────────────────
    emotion_counter: Counter = Counter()
    tagged_count = 0
    for d in dreams:
        tags = d.get("emotion_tags") or []
        if tags:
            tagged_count += 1
            emotion_counter.update(tags)

    if tagged_count > 0:
        emotion_distribution = [
            {"label": label, "pct": round(count / tagged_count * 100)}
            for label, count in emotion_counter.most_common(5)
        ]
    else:
        emotion_distribution = []

    # ── Symbol recurrence (top 5) ─────────────────────────────────────────
    symbol_counter: Counter = Counter()
    for d in dreams:
        tags = d.get("symbol_tags") or []
        symbol_counter.update(tags)

    recurrence = []
    for label, count in symbol_counter.most_common(5):
        pct = round(count / max(total_dreams, 1) * 100)
        recurrence.append({
            "label": label,
            "value": f"{count}\u00d7",
            "note": f"Appeared in {pct}% of dreams",
        })

    # ── Dream streak + last7 ──────────────────────────────────────────────
    dream_dates = set()
    for d in dreams:
        ra = d.get("recorded_at")
        if ra:
            dream_dates.add(ra[:10])  # "YYYY-MM-DD"

    today = now.date()
    last7 = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        last7.append(day.isoformat() in dream_dates)

    current_streak = 0
    for i in range(len(last7) - 1, -1, -1):
        if last7[i]:
            current_streak += 1
        else:
            break

    # ── Heatmap (current month, 7×N grid: Mon=0 … Sun=6 × weeks) ────────
    year, month = today.year, today.month
    heatmap_month = calendar.month_name[month]
    _, days_in_month = calendar.monthrange(year, month)

    # Count dreams per day this month
    day_counts: dict[int, int] = {}
    month_prefix = f"{year}-{month:02d}-"
    for date_str in dream_dates:
        if date_str.startswith(month_prefix):
            day_num = int(date_str[8:10])
            day_counts[day_num] = day_counts.get(day_num, 0) + 1

    # Build 7×N grid
    first_weekday = calendar.weekday(year, month, 1)  # 0=Mon
    num_weeks = (first_weekday + days_in_month + 6) // 7
    grid = [[0] * num_weeks for _ in range(7)]

    for day_num in range(1, days_in_month + 1):
        wd = calendar.weekday(year, month, day_num)
        week_idx = (first_weekday + day_num - 1) // 7
        grid[wd][week_idx] = min(day_counts.get(day_num, 0), 4)

    # ── Upsert ────────────────────────────────────────────────────────────
    profile = {
        "user_id": user_id,
        "emotion_distribution": emotion_distribution,
        "recurrence": recurrence,
        "current_streak": current_streak,
        "last7": last7,
        "heatmap_data": grid,
        "heatmap_month": heatmap_month,
        "total_dreams": total_dreams,
        "updated_at": now.isoformat(),
    }

    client.table("user_profiles").upsert(profile, on_conflict="user_id").execute()
    logger.info(f"[recompute_profile] user={user_id} total_dreams={total_dreams} streak={current_streak}")
    return profile
