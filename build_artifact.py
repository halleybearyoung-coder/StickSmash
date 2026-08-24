#!/usr/bin/env python3
"""Bundle the StickSmash repo (index.html + style.css + game.js + sprite PNGs)
into a single self-contained HTML file for Artifact publishing / standalone sharing.
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "sticksmash_artifact.html"

FRAME_RE = re.compile(r"^(.+)_(\d+)\.png$")

def discover_actions():
    """Auto-discover action names + frame counts from assets/frames/ so this
    never again silently drops sprites when a new action/character is added."""
    frames_dir = ROOT / "assets" / "frames"
    max_idx = {}
    for p in frames_dir.glob("*.png"):
        m = FRAME_RE.match(p.name)
        if not m:
            continue
        action, idx = m.group(1), int(m.group(2))
        max_idx[action] = max(max_idx.get(action, -1), idx)
    return {action: idx + 1 for action, idx in max_idx.items()}

def build_sprite_map():
    sprites = {}
    for action, frame_count in discover_actions().items():
        frames = []
        for i in range(frame_count):
            p = ROOT / "assets" / "frames" / f"{action}_{i}.png"
            data = base64.b64encode(p.read_bytes()).decode("ascii")
            frames.append(f"data:image/png;base64,{data}")
        sprites[action] = frames
    return sprites

def main():
    style_css = (ROOT / "style.css").read_text()
    game_js = (ROOT / "game.js").read_text()
    sprites = build_sprite_map()
    sprite_json = json.dumps(sprites)

    # Strip the outer <html>/<head>/<body> wrapper from index.html's body content
    index_html = (ROOT / "index.html").read_text()
    body_match = re.search(r"<body>(.*)</body>", index_html, re.S)
    body_inner = body_match.group(1)
    # remove the <script src="game.js"></script> tag, we inline it manually below
    body_inner = body_inner.replace('<script src="game.js"></script>', "")

    html = f"""<title>StickSmash</title>
<meta name="description" content="A hand-drawn stick-figure Smash-Bros-style local fighting game." />
<style>
{style_css}
</style>
{body_inner}
<script>
window.SPRITE_BASE64 = {sprite_json};
</script>
<script>
{game_js}
</script>
"""
    OUT.write_text(html)
    print("wrote", OUT, OUT.stat().st_size / 1024, "KB")

if __name__ == "__main__":
    main()
