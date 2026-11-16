"""Downloads the CC0 assets (photographic textures, sky HDRIs, models) from polyhaven.com into public/assets.
Every asset lands in its own folder; nothing downloaded is ever executed. Run: python tools/fetch_assets.py
"""
import json, math, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets')
API = 'https://api.polyhaven.com'
UA = {'User-Agent': 'floorplan-walkthrough-asset-fetch'}

TEXTURES = {  # key -> polyhaven id
    'tile': 'interior_tiles', 'bath': 'large_floor_tiles_02', 'wallTile': 'long_white_tiles', 'stone': 'pebble_cemented_floor',
    'balcony': 'patio_tiles', 'concrete': 'concrete_wall_008', 'plaster': 'painted_plaster_wall',
    'oak': 'oak_veneer_01', 'walnut': 'walnut_veneer', 'teak': 'teak_veneer', 'asphalt': 'asphalt_04',
    'brick': 'brick_wall_005', 'ground': 'dry_ground_01',
}
HDRIS = {'day': 'qwantani_dusk_2_puresky', 'night': 'qwantani_night_puresky'}
MODELS = ['ceiling_fan', 'mid_century_lounge_chair', 'potted_plant_04']


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return os.path.getsize(dest)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(dest, 'wb') as f:
        f.write(r.read())
    return os.path.getsize(dest)


def read_rgbe(path):
    import numpy as np
    with open(path, 'rb') as f:
        data = f.read()
    pos = 0
    while True:  # header
        end = data.index(b'\n', pos)
        line = data[pos:end]
        pos = end + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split()
            h, w = int(parts[1]), int(parts[3])
            break
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2 and (data[pos + 2] << 8 | data[pos + 3]) == w:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128; img[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data[pos:pos + n], dtype=np.uint8); pos += n
                    x += n
        else:
            img[y] = np.frombuffer(data[pos:pos + 4 * w], dtype=np.uint8).reshape(w, 4); pos += 4 * w
    e = img[:, :, 3].astype(np.float32)
    scale = np.where(e > 0, np.power(2.0, e - 136.0), 0.0)
    return img[:, :, :3].astype(np.float32) * scale[:, :, None]


def sun_direction(path):
    import numpy as np
    rgb = read_rgbe(path)
    lum = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    h, w = lum.shape
    # weight rows by cos(latitude) so the poles do not win
    lat = (0.5 - (np.arange(h) + 0.5) / h) * math.pi
    lum = lum * np.cos(lat)[:, None]
    y, x = np.unravel_index(np.argmax(lum), lum.shape)
    u, v = (x + 0.5) / w, 1.0 - (y + 0.5) / h
    phi, theta = (u - 0.5) * 2 * math.pi, (v - 0.5) * math.pi
    return [math.cos(phi) * math.cos(theta), math.sin(theta), math.sin(phi) * math.cos(theta)], float(lum.max())


manifest = {'textures': {}, 'hdri': {}, 'models': {}}
total = 0
for key, pid in TEXTURES.items():
    files = get_json(f'{API}/files/{pid}')
    info = get_json(f'{API}/info/{pid}')
    maps = {}
    for name, label in (('diff', 'Diffuse'), ('nor', 'nor_gl'), ('rough', 'Rough')):
        url = files[label]['1k']['jpg']['url']
        dest = os.path.join(ROOT, 'textures', pid, os.path.basename(url))
        total += download(url, dest)
        maps[name] = f'assets/textures/{pid}/{os.path.basename(url)}'
    dims = info.get('dimensions') or [1000, 1000]
    manifest['textures'][key] = {'id': pid, 'size_m': [dims[0] / 1000.0, dims[1] / 1000.0], 'maps': maps}
    print('texture', key, pid, round(total / 1e6, 1), 'MB so far', flush=True)

for key, pid in HDRIS.items():
    files = get_json(f'{API}/files/{pid}')
    url = files['hdri']['2k']['hdr']['url']
    dest = os.path.join(ROOT, 'hdri', pid, os.path.basename(url))
    total += download(url, dest)
    d, peak = sun_direction(dest)
    manifest['hdri'][key] = {'id': pid, 'file': f'assets/hdri/{pid}/{os.path.basename(url)}', 'sun': d, 'peak': peak}
    print('hdri', key, pid, 'sun', [round(x, 2) for x in d], 'peak', round(peak, 1), flush=True)

for pid in MODELS:
    files = get_json(f'{API}/files/{pid}')
    g = files['gltf']['1k']['gltf']
    base = os.path.join(ROOT, 'models', pid)
    total += download(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, meta in g['include'].items():
        total += download(meta['url'], os.path.join(base, rel))
    manifest['models'][pid] = {'file': f"assets/models/{pid}/{os.path.basename(g['url'])}"}
    print('model', pid, round(total / 1e6, 1), 'MB so far', flush=True)

with open(os.path.join(ROOT, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
with open(os.path.join(ROOT, 'ATTRIBUTION.md'), 'w') as f:
    f.write('# Assets\n\nAll textures, HDRIs and models in this folder come from https://polyhaven.com and are CC0 (public domain).\n\n')
    for key, t in manifest['textures'].items(): f.write(f"- texture `{t['id']}` (used for {key})\n")
    for key, h in manifest['hdri'].items(): f.write(f"- HDRI `{h['id']}` ({key} sky)\n")
    for pid in manifest['models']: f.write(f"- model `{pid}`\n")
print('done, total', round(total / 1e6, 1), 'MB')
