"""Make web-ready 4:5 photos for the site.
For each card: front.jpg (1200x1500) and front-thumb.jpg (600x750) in img/cards/<ID>/.
Photos wider than 4:5 that would clip the card get a blurred fill instead of a crop.
Usage: python3 prep_photos.py SRC_DIR "MHC-0748=photo-02,MHC-0804=photo-01:fill,..." [--kind front|back]
"""
import os, sys
from PIL import Image, ImageOps, ImageFilter, ImageEnhance

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def four_five(im, fill=False):
    w, h = im.size
    if fill:
        H = round(w / 0.8)
        if H <= h:  # already tall enough, just crop
            fill = False
        else:
            cw = round(w * H / h)
            bg = im.resize((cw, H)).crop(((cw - w) // 2, 0, (cw - w) // 2 + w, H))
            bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(w / 50))).enhance(0.55)
            bg.paste(im, (0, (H - h) // 2))
            return bg
    if w / h > 0.8:
        cw = round(h * 0.8); return im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    ch = round(w / 0.8); return im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))

def main():
    src, spec = sys.argv[1], sys.argv[2]
    kind = sys.argv[sys.argv.index('--kind') + 1] if '--kind' in sys.argv else 'front'
    files = os.listdir(src)
    for item in spec.split(','):
        cid, rest = item.split('=')
        ph, _, mode = rest.partition(':')
        f = next(x for x in files if x.startswith(cid + '_') and x.endswith(ph + '.jpg'))
        im = ImageOps.exif_transpose(Image.open(os.path.join(src, f))).convert('RGB')
        out = four_five(im, fill=(mode == 'fill'))
        d = os.path.join(SITE, 'img', 'cards', cid); os.makedirs(d, exist_ok=True)
        out.resize((1200, 1500), Image.LANCZOS).save(os.path.join(d, f'{kind}.jpg'), quality=82, optimize=True, progressive=True)
        out.resize((600, 750), Image.LANCZOS).save(os.path.join(d, f'{kind}-thumb.jpg'), quality=78, optimize=True, progressive=True)
        print(cid, f, mode or 'crop')

if __name__ == '__main__':
    main()
