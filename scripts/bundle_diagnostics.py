import os
import zipfile

def bundle_runs(dst='runs/diagnostics_bundle.zip'):
    base = 'runs'
    if not os.path.isdir(base):
        print('No runs/ directory found')
        return 2
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(base):
            for f in files:
                full = os.path.join(root, f)
                arc = os.path.relpath(full, base)
                z.write(full, arc)
    print('Created', dst)
    return 0

if __name__ == '__main__':
    raise SystemExit(bundle_runs())
