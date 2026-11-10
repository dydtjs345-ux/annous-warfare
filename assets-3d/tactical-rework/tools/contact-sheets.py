"""Make fixed-framing phase sheets from actual renderer captures."""
from PIL import Image, ImageDraw
from pathlib import Path
import os

root = Path(__file__).resolve().parents[1]
frames = Path(os.environ.get('AW_REWORK_FRAMES', '/tmp/aw-tactical-baseline')) / 'phases'
actions = ['SprintProne', 'CrawlForward', 'CrouchWalk', 'ProneStand', 'CoverEnter', 'CoverExit']
for faction in ['USMC', 'Russian']:
    for view in ['side', 'iso30']:
        sheet = Image.new('RGB', (2560, 6 * 222 + 40), '#17232f')
        draw = ImageDraw.Draw(sheet)
        draw.text((10, 12), faction + ' | ORIGINAL BASELINE | ' + view + ' | Fixed frame per action; no pose edits; no external reference footage available.', fill='#f2f6fa')
        for row, action in enumerate(actions):
            for phase in range(8):
                image = Image.open(frames / f'{faction}-{action}-{view}-{phase}.png').convert('RGB')
                image = image.resize((320, 200), Image.Resampling.LANCZOS)
                sheet.paste(image, (phase * 320, row * 222 + 40))
                draw.text((phase * 320 + 8, row * 222 + 242), f'{action} | phase {phase + 1}/8', fill='#d6e6f3')
        sheet.save(root / 'review' / f'{faction}-original-{view}.jpg', quality=93)
