"""Turns the downloaded beige ceramic floor tile into white vitrified tile with light grey grout (run after fetch_assets.py)."""
import os
import numpy as np
from PIL import Image
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'textures', 'interior_tiles', 'interior_tiles_diff_1k.jpg')
im = Image.open(p).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
L = a.mean(axis=2)
# the original is already tuned once; use its luminance only
lo, hi = np.percentile(L, 3), np.percentile(L, 60)
Ln = np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1)
m = Ln * Ln * (3 - 2 * Ln)                       # smoothstep: 0 = grout, 1 = tile body
body = 0.945 + 0.055 * np.clip((L - hi) / max(1 - hi, 1e-3), 0, 1)
out = 0.70 * (1 - m) + body * m
rgb = np.stack([out * 0.995, out * 1.0, out * 1.008], axis=2)
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(p, quality=93)
print('white tile written', p)
