import os, tempfile, asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
import yt_dlp

TOKEN = os.environ["BOT_TOKEN"]
MAX_MB = 50  # حد تيليجرام للبوتات

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("أهلاً! أرسل رابط فيديو وسأقوم بتحميله لك.")

def download(url: str, folder: str) -> str:
    opts = {
        "outtmpl": f"{folder}/%(title).60s.%(ext)s",
        "format": f"best[filesize<{MAX_MB}M]/best",
        "quiet": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)

async def handle(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    url = update.message.text.strip()
    if not url.startswith("http"):
        await update.message.reply_text("أرسل رابطاً صحيحاً يبدأ بـ http")
        return
    msg = await update.message.reply_text("جاري التحميل...")
    with tempfile.TemporaryDirectory() as tmp:
        try:
            path = await asyncio.to_thread(download, url, tmp)
            if os.path.getsize(path) > MAX_MB * 1024 * 1024:
                await msg.edit_text("الملف أكبر من 50 ميجا.")
                return
            with open(path, "rb") as f:
                await update.message.reply_video(f)
            await msg.delete()
        except Exception as e:
            await msg.edit_text(f"فشل التحميل: {str(e)[:200]}")

app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))
if __name__ == "__main__":
    app.run_polling()
