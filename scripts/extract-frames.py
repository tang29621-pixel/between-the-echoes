# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = sys.stdout

"""
从视频中均匀抽取关键帧，作为后续章节背景候选。
"""
import cv2
import os
from pathlib import Path
import math
import numpy as np

VIDEO = "assets/video.mp4"
OUT_DIR = Path("assets/images/frames")
OUT_DIR.mkdir(parents=True, exist_ok=True)

cap = cv2.VideoCapture(VIDEO)
if not cap.isOpened():
    raise SystemExit("无法打开视频文件")

fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps if fps else 0
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"视频信息：{width}x{height} · {fps:.2f} fps · {duration:.1f}s · 共 {total_frames} 帧")

# 抽帧策略：每秒取 1 帧，再跳过开头/结尾黑场
NUM_FRAMES = 24  # 抽 24 帧均匀分布
samples = []
for i in range(NUM_FRAMES):
    t = (i + 0.5) / NUM_FRAMES
    # 跳过最前 5% 和最后 5%（通常是黑场/片尾）
    t = 0.05 + t * 0.9
    samples.append(int(t * total_frames))

print(f"将抽取 {len(samples)} 帧")

# 检测黑场：亮度均值低于阈值则跳过
def is_black(frame, thresh=15):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return gray.mean() < thresh

results = []
for idx, fnum in enumerate(samples):
    cap.set(cv2.CAP_PROP_POS_FRAMES, fnum)
    ok, frame = cap.read()
    if not ok:
        continue
    if is_black(frame):
        continue

    # 缩到合理尺寸
    target_w = 1280
    if frame.shape[1] > target_w:
        scale = target_w / frame.shape[1]
        frame = cv2.resize(frame, (target_w, int(frame.shape[0] * scale)), interpolation=cv2.INTER_AREA)

    # 保存
    t_sec = fnum / fps
    name = f"frame-{idx+1:02d}.jpg"
    path = OUT_DIR / name
    cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    results.append((idx + 1, t_sec, path, frame))
    print(f"  [OK] {name}  t={t_sec:.2f}s")

cap.release()

# 生成预览网格（6 列）
if results:
    cols = 6
    rows = math.ceil(len(results) / cols)
    cell_w = 320
    cell_h = int(cell_w * height / width)
    grid = cv2.copyMakeBorder(
        cv2.imread(str(results[0][2])), 0, 0, 0, 0, cv2.BORDER_CONSTANT, value=[10, 18, 26])

    # 取 cell 高度
    sample = cv2.imread(str(results[0][2]))
    cell_h = int(cell_w * sample.shape[0] / sample.shape[1])

    grid_img = np_full = None
    import numpy as np
    grid_img = np.full((rows * (cell_h + 40), cols * cell_w, 3), 10, dtype=np.uint8)

    for i, (idx, t_sec, path, _) in enumerate(results):
        r, c = i // cols, i % cols
        img = cv2.imread(str(path))
        img = cv2.resize(img, (cell_w, cell_h))
        y = r * (cell_h + 40)
        x = c * cell_w
        grid_img[y:y+cell_h, x:x+cell_w] = img
        # 标注
        cv2.putText(grid_img, f"#{idx}  t={t_sec:.1f}s", (x + 8, y + cell_h + 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (216, 200, 154), 1, cv2.LINE_AA)

    grid_path = OUT_DIR / "_grid.jpg"
    cv2.imwrite(str(grid_path), grid_img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(f"\n[OK] 预览网格：{grid_path}")
    print(f"[OK] 单独帧目录：{OUT_DIR}")

print(f"\n抽帧完成，共 {len(results)} 帧可用。")
