import os
import zipfile

def zip_dir(src, dst):
    if not os.path.exists(src):
        print('MISSING', src)
        return 2
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(src):
            for fn in files:
                full = os.path.join(root, fn)
                arcname = os.path.relpath(full, src)
                z.write(full, arcname)
    print('ZIPPED', dst)
    return 0

if __name__ == '__main__':
    src = os.path.join('runs', 'notifier_local')
    dst = os.path.join('runs', 'notifier_local.zip')
    raise SystemExit(zip_dir(src, dst))
