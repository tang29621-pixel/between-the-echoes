# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = sys.stdout

"""
把选中的视频帧处理成冷色调背景图：
- 缩放到合适尺寸
- 降低饱和度
- 加深蓝冷色叠加
- 适当模糊/暗化
"""
import cv2
import numpy as np
from pathlib import Path

SRC = Path("assets/images/frames")
DST = Path("assets/images/frames/processed")
DST.mkdir(parents=True, exist_ok=True)

# 帧选择：物品编号 → 源文件名 → 输出用途
SELECTIONS = {
    "item-painting-bg.jpg":   "frame-01.jpg",  # 画（实际是组合图，作为画的氛围）
    "item-ticket-bg.jpg":     "frame-08.jpg",  # 车票（信旁有车票）
    "item-cup-bg.jpg":        "frame-14.jpg",  # 缺口杯（最完整特写）
    "item-letter-bg.jpg":     "frame-08.jpg",  # 信（同一帧，crop 信区域）
    "sea-bench-bg.jpg":       "frame-13.jpg",  # 海边长椅
    "sea-letter-bg.jpg":      "frame-15.jpg",  # 海边回信（全息）
    "end-bg.jpg":             "frame-15.jpg",  # 结束页（升华画面）
}

# 冷色调处理参数
def apply_cold_tone(img, blur=0, brightness=0.55, saturation=0.55, blue_tint=0.25):
    """
    降饱和 + 调暗 + 加深蓝冷色叠加
    """
    # 1. 缩放
    h, w = img.shape[:2]
    max_w = 1600
    if w > max_w:
        scale = max_w / w
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 2. 转 HSV 处理
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    # 降低饱和度
    hsv[..., 1] *= saturation
    # 调整色相：往蓝色方向偏
    hsv[..., 0] = (hsv[..., 0] + 10) % 180  # 加 10 度，更蓝
    hsv = np.clip(hsv, 0, 255).astype(np.uint8)
    img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # 3. 整体调暗
    img = np.clip(img.astype(np.float32) * brightness, 0, 255).astype(np.uint8)

    # 4. 蓝色叠加层
    blue_overlay = np.full_like(img, (28, 38, 58))  # BGR 深蓝
    img = cv2.addWeighted(img, 1 - blue_tint, blue_overlay, blue_tint, 0)

    # 5. 暗角（vignette）
    h, w = img.shape[:2]
    y, x = np.ogrid[:h, :w]
    cy, cx = h / 2, w / 2
    vignette = 1 - 0.45 * ((x - cx) ** 2 + (y - cy) ** 2) / (cx ** 2 + cy ** 2)
    vignette = np.clip(vignette, 0.4, 1.0)
    img = np.clip(img.astype(np.float32) * vignette[..., None], 0, 255).astype(np.uint8)

    # 6. 轻微模糊（让背景不抢前景文字）
    if blur > 0:
        img = cv2.GaussianBlur(img, (blur, blur), 0)

    return img


def crop_letter_region(img):
    """crop 信所在的中间区域（frame-08 中信占据中央）"""
    h, w = img.shape[:2]
    # 信在中间偏上
    x1, y1 = int(w * 0.20), int(h * 0.10)
    x2, y2 = int(w * 0.80), int(h * 0.85)
    return img[y1:y2, x1:x2]


def crop_horizon(img):
    """crop frame-15 中右半部分的全息投影"""
    h, w = img.shape[:2]
    # 全息在右侧
    x1, y1 = int(w * 0.45), int(h * 0.10)
    x2, y2 = int(w * 0.95), int(h * 0.85)
    return img[y1:y2, x1:x2]


for out_name, src_name in SELECTIONS.items():
    src = SRC / src_name
    if not src.exists():
        print(f"  [SKIP] {src_name} not found")
        continue

    img = cv2.imread(str(src))

    # 对信帧做裁剪
    if out_name == "item-letter-bg.jpg":
        img = crop_letter_region(img)

    # 对 frame-15 的全息部分裁剪
    if out_name == "sea-letter-bg.jpg":
        img = crop_horizon(img)

    # 不同的模糊度：物品背景用低模糊（保留细节），海边/结束页用稍强模糊
    blur = 3 if out_name.startswith("sea-") or out_name == "end-bg.jpg" else 1

    processed = apply_cold_tone(img, blur=blur)

    out_path = DST / out_name
    cv2.imwrite(str(out_path), processed, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(f"  [OK] {out_name}  <-  {src_name}  ({processed.shape[1]}x{processed.shape[0]})")

print(f"\n处理完成，输出目录：{DST}")
