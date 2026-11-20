# Sites source helper is not installed in this environment. This equivalent
# buildless static sync uses the native repo credential only in process memory.
import json, os, subprocess, sys
creds=json.loads(sys.stdin.readline())
root='/workspace/sites/complete-infantry'
subprocess.run(['git','init','-b',creds['branch']],cwd=root,check=True,stdout=subprocess.DEVNULL)
subprocess.run(['git','config','user.name','Codex'],cwd=root,check=True)
subprocess.run(['git','config','user.email','codex@openai.com'],cwd=root,check=True)
subprocess.run(['git','add','.'],cwd=root,check=True)
if subprocess.run(['git','diff','--cached','--quiet'],cwd=root).returncode:
    subprocess.run(['git','commit','-m','Publish isolated infantry integration static snapshot'],cwd=root,check=True,stdout=subprocess.DEVNULL)
if subprocess.run(['git','remote','get-url','origin'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
    subprocess.run(['git','remote','add','origin',creds['remote_url']],cwd=root,check=True)
env=os.environ.copy();env['GIT_TERMINAL_PROMPT']='0'
if creds.get('token'):
    value='Bearer '+creds['token']
    env['GIT_CONFIG_COUNT']='1'
    env['GIT_CONFIG_KEY_0']='http.extraheader'
    env['GIT_CONFIG_VALUE_0']='AUTHORIZATION: '+value
result=subprocess.run(['git','push','-u','origin',creds['branch']],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
if result.returncode:
    print('Site source push failed (credential redacted).',file=sys.stderr)
    sys.exit(result.returncode)
print(json.dumps({'commit_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'project_id':json.load(open(root+'/.openai/hosting.json'))['project_id']}))
