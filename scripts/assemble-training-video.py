import os
import subprocess
import glob

OUT_DIR = os.path.abspath("artifacts/task4_video")
FINAL_MP4 = os.path.join(OUT_DIR, "kucet_payment_fraud_training.mp4")
CONCAT_FILE = os.path.join(OUT_DIR, "concat_list.txt")

def assemble():
    print("Checking audio and slide files...")
    segment_files = []

    for i in range(1, 13):
        slide = os.path.join(OUT_DIR, f"scene{i}.png")
        audio = os.path.join(OUT_DIR, f"scene{i}.mp3")
        segment = os.path.join(OUT_DIR, f"segment{i}.mp4")

        if not os.path.exists(slide) or not os.path.exists(audio):
            raise FileNotFoundError(f"Missing slide or audio for scene {i}")

        # Render segment: 1920x1080 30fps H.264 + AAC audio, padded with 0.5s silence at end
        print(f"Rendering segment {i} of 12...")
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1",
            "-r", "5",
            "-i", slide,
            "-i", audio,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "stillimage",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            segment
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            print("FFmpeg error:", res.stderr[-500:])
            raise RuntimeError(f"FFmpeg failed on segment {i}")
        segment_files.append(segment)

    # Write concat list
    with open(CONCAT_FILE, "w") as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    print("Concatenating 12 segments into final master video...")
    srt_file = os.path.join(OUT_DIR, "captions.srt")
    
    # Concat and embed subtitle track
    concat_cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", CONCAT_FILE,
        "-c", "copy",
        FINAL_MP4
    ]
    res = subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print("FFmpeg concat error:", res.stderr[-500:])
        raise RuntimeError("FFmpeg concat failed")

    print(f"Master training video generated at: {FINAL_MP4}")

    # Clean up intermediate segment mp4s and concat file to keep workspace clean
    for seg in segment_files:
        try:
            os.remove(seg)
        except OSError:
            pass
    try:
        os.remove(CONCAT_FILE)
    except OSError:
        pass

if __name__ == "__main__":
    assemble()
