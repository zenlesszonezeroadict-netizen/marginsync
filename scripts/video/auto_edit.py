#!/usr/bin/env python3
"""
MarginSync Auto-Editor
======================
Turns your raw phone clips into one ready-to-post 9:16 vertical video for
TikTok / Reels / YouTube Shorts. No editing skills needed.

HOW IT WORKS
  1. You drop your raw clips into the  raw/  folder, named in the order you
     want them played:  01_hook.mp4 , 02_demo.mp4 , 03_cta.mp4  ...
  2. (optional) Put one music track in  music/  (an .mp3).
  3. (optional) Write captions in  captions.srt  — OR let it auto-caption for
     you if Whisper is installed (run install-auto-captions.bat once).
  4. Double-click  make-video.bat .
  5. Your finished video appears in  output/finished.mp4 .

What it does to each clip:
  - reformats to 1080x1920 (the 9:16 size TikTok/Reels/Shorts want)
  - crops to fill the frame (no ugly black bars)
  - evens out the framerate and audio so the clips join cleanly
  - stitches them together in order
  - mixes your music in quietly under your voice (if you added one)
  - burns captions onto the video (if you provided / generated them)
"""

import os
import sys
import glob
import subprocess

HERE      = os.path.dirname(os.path.abspath(__file__))
RAW_DIR   = os.path.join(HERE, "raw")
OUT_DIR   = os.path.join(HERE, "output")
MUSIC_DIR = os.path.join(HERE, "music")
WORK_DIR  = os.path.join(HERE, ".work")
SRT_PATH  = os.path.join(HERE, "captions.srt")
FINAL     = os.path.join(OUT_DIR, "finished.mp4")

W, H, FPS = 1080, 1920, 30          # TikTok / Reels / Shorts canvas
MUSIC_VOLUME = 0.12                  # background music level (0..1) under the voice

VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm")


def run(cmd):
    """Run an ffmpeg command, surfacing a clean error if it fails."""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("\nffmpeg error:\n" + proc.stderr[-1500:])
        raise SystemExit(1)


def find_clips():
    files = [f for f in glob.glob(os.path.join(RAW_DIR, "*"))
             if os.path.splitext(f)[1].lower() in VIDEO_EXTS]
    return sorted(files, key=lambda p: os.path.basename(p).lower())


def normalize(src, dst):
    """Reformat one clip to a clean 1080x1920 / 30fps / AAC clip that will
    concatenate seamlessly with the others."""
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H},fps={FPS},format=yuv420p")
    run(["ffmpeg", "-y", "-i", src,
         "-vf", vf,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-r", str(FPS),
         "-c:a", "aac", "-ar", "48000", "-ac", "2",
         "-shortest", dst])


def concat(parts, dst):
    """Join the normalized clips in order (lossless stream copy)."""
    listfile = os.path.join(WORK_DIR, "concat.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for p in parts:
            f.write(f"file '{p.replace(os.sep, '/')}'\n")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile,
         "-c", "copy", dst])


def find_music():
    for ext in ("*.mp3", "*.m4a", "*.wav", "*.aac"):
        hits = glob.glob(os.path.join(MUSIC_DIR, ext))
        if hits:
            return sorted(hits)[0]
    return None


def add_music(video, music, dst):
    """Duck a music bed under the existing voice audio."""
    run(["ffmpeg", "-y", "-i", video, "-stream_loop", "-1", "-i", music,
         "-filter_complex",
         f"[1:a]volume={MUSIC_VOLUME}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3[a]",
         "-map", "0:v", "-map", "[a]",
         "-c:v", "copy", "-c:a", "aac", "-shortest", dst])


def maybe_autocaption(video):
    """If faster-whisper is installed, transcribe the video into captions.srt.
    Silently skips if it isn't installed (run install-auto-captions.bat to add it)."""
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return False
    print("  Auto-captioning with Whisper (first run downloads the model, please wait)...")
    # Pull audio out for transcription
    wav = os.path.join(WORK_DIR, "audio.wav")
    run(["ffmpeg", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav])
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(wav, vad_filter=True)

    def ts(t):
        h = int(t // 3600); m = int((t % 3600) // 60)
        s = int(t % 60); ms = int((t - int(t)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    with open(SRT_PATH, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            f.write(f"{i}\n{ts(seg.start)} --> {ts(seg.end)}\n{seg.text.strip()}\n\n")
    return os.path.getsize(SRT_PATH) > 0


def burn_captions(video, dst):
    """Burn captions.srt onto the video as big, centered, TikTok-style text."""
    # Run from HERE so ffmpeg's subtitles filter gets a simple relative path
    # (Windows absolute paths with drive letters trip up the filter parser).
    style = ("FontName=Arial,FontSize=16,Bold=1,PrimaryColour=&H00FFFFFF,"
             "OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,"
             "Alignment=2,MarginV=140")
    run(["ffmpeg", "-y", "-i", video,
         "-vf", f"subtitles=captions.srt:force_style='{style}'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-c:a", "copy", dst])


def reset_work():
    import shutil
    if os.path.isdir(WORK_DIR):
        shutil.rmtree(WORK_DIR, ignore_errors=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(MUSIC_DIR, exist_ok=True)


def main():
    os.chdir(HERE)
    reset_work()

    clips = find_clips()
    if not clips:
        print("\nNo clips found.")
        print(f"Put your raw videos in:  {RAW_DIR}")
        print("Name them in order, e.g.  01_hook.mp4 , 02_demo.mp4 , 03_cta.mp4")
        raise SystemExit(1)

    print(f"Found {len(clips)} clip(s):")
    for c in clips:
        print("   - " + os.path.basename(c))

    print("\n[1/4] Reformatting clips to 9:16...")
    parts = []
    for i, src in enumerate(clips, 1):
        dst = os.path.join(WORK_DIR, f"part_{i:02d}.mp4")
        print(f"   clip {i}/{len(clips)}: {os.path.basename(src)}")
        normalize(src, dst)
        parts.append(dst)

    print("\n[2/4] Stitching clips together...")
    stitched = os.path.join(WORK_DIR, "stitched.mp4")
    concat(parts, stitched)
    current = stitched

    music = find_music()
    if music:
        print(f"\n[3/4] Mixing in music: {os.path.basename(music)}")
        withmusic = os.path.join(WORK_DIR, "withmusic.mp4")
        add_music(current, music, withmusic)
        current = withmusic
    else:
        print("\n[3/4] No music found in music/ — skipping (that's fine).")

    print("\n[4/4] Captions...")
    have_srt = os.path.isfile(SRT_PATH) and os.path.getsize(SRT_PATH) > 0
    if not have_srt:
        have_srt = maybe_autocaption(current)
    if have_srt:
        print("   Burning captions onto the video...")
        burn_captions(current, FINAL)
    else:
        print("   No captions (no captions.srt and Whisper not installed) — skipping.")
        run(["ffmpeg", "-y", "-i", current, "-c", "copy", FINAL])

    print("\nDONE!  Your video is ready:")
    print("   " + FINAL)
    print("\nPost it to TikTok, Instagram Reels, and YouTube Shorts.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"\nSomething went wrong: {e}")
        sys.exit(1)
