import tarfile
import os
base='artifacts/22835085000'
artdir=os.path.join(base,'artifacts')
outdir=os.path.join(base,'extracted')
os.makedirs(outdir,exist_ok=True)

def list_tar(path):
    print(f'--- Listing {path} ---')
    if not os.path.exists(path):
        print('MISSING')
        return []
    with tarfile.open(path,'r:gz') as t:
        names=t.getnames()
        for n in names[:200]:
            print(n)
        return names

logs_tar=os.path.join(artdir,'ci_force_logs.tar.gz')
workspace_tar=os.path.join(artdir,'ci_force_workspace.tar.gz')

logs_names=list_tar(logs_tar)
ws_names=list_tar(workspace_tar)

# Try to extract logs tar entirely (small)
if os.path.exists(logs_tar):
    with tarfile.open(logs_tar,'r:gz') as t:
        t.extractall(path=outdir)

# From workspace tar, extract only apps/ml-engine/logs/* if present
if os.path.exists(workspace_tar):
    with tarfile.open(workspace_tar,'r:gz') as t:
        members=[m for m in t.getmembers() if m.name.startswith('apps/ml-engine/logs/')]
        if members:
            print('\n--- Extracting apps/ml-engine/logs/* from workspace tar ---')
            t.extractall(path=outdir,members=members)
        else:
            print('\nNo apps/ml-engine/logs/ entries found in workspace tar')

# Print ups_events tail if present
ups_path=os.path.join(outdir,'apps','ml-engine','logs','ups_events.jsonl')
if os.path.exists(ups_path):
    print('\n--- Last 20 lines of ups_events.jsonl ---')
    with open(ups_path,'rb') as f:
        data=f.read().splitlines()
        for line in data[-20:]:
            try:
                print(line.decode('utf-8'))
            except:
                print(repr(line))
else:
    print('\nups_events.jsonl not found in extracted artifacts')

# Print any log files found (first 200 chars)
logdir=os.path.join(outdir,'apps','ml-engine','logs')
if os.path.isdir(logdir):
    for fn in os.listdir(logdir):
        p=os.path.join(logdir,fn)
        print(f'\n--- {fn} (size={os.path.getsize(p)}) ---')
        with open(p,'r',errors='replace') as f:
            print(f.read(200))
else:
    print('\nNo logs directory extracted')

print('\n--- done ---')
