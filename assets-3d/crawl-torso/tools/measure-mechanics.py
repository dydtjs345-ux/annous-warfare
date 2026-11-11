"""Independent pose diagnostics; these do not measure forces or true COM."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'validation'
def multiply(a,b):
 w,x,y,z=a;v,s,t,u=b
 return [w*v-x*s-y*t-z*u,w*s+x*v+y*u-z*t,w*t-x*u+y*v+z*s,w*u+x*t-y*s+z*v]
def inverse(q):return [q[0],-q[1],-q[2],-q[3]]
def angle(a,b):
 dot=abs(sum(x*y for x,y in zip(a,b)))/math.sqrt(sum(x*x for x in a)*sum(x*x for x in b))
 return math.degrees(2*math.acos(min(1,dot)))
def angular_range(qs):return max(angle(a,b)for a in qs for b in qs)
for faction in ['USMC','Russian']:
 old=json.loads((ROOT/f'{faction}-before-source.json').read_text());new=json.loads((ROOT/f'{faction}-authored.json').read_text())
 out={'faction':faction,'scope':'Pose diagnostics, not force or center-of-mass simulation.','joints':{}}
 for name in old['metrics']:
  qs=[s['bones'][name]['quaternion']for s in new['bodySamples']];local=[s['bones'][name]['localQuaternion']for s in new['bodySamples']]
  out['joints'][name]={'beforeWorldRangeDeg':old['metrics'][name]['worldAngleRangeDeg'],'afterWorldRangeDeg':angular_range(qs),'beforeLocalRangeDeg':old['metrics'][name]['localAngleRangeDeg'],'afterLocalRangeDeg':angular_range(local)}
 before=[multiply(inverse(s['bones']['root']['worldQuaternion']),s['bones']['spine02']['worldQuaternion'])for s in old['samples']]
 after=[multiply(inverse(s['bones']['root']['quaternion']),s['bones']['spine02']['quaternion'])for s in new['bodySamples']]
 out['ribCageRelativeToPelvisRangeDeg']={'before':angular_range(before),'after':angular_range(after)}
 out['loadedTrunkProjections']=[{'time':s['time'],'loadLeft':s['loadLeft'],'pelvisX':s['bones']['root']['position'][0],'ribCageX':s['bones']['spine02']['position'][0]}for s in new['bodySamples']]
 left=[s for s in out['loadedTrunkProjections']if s['loadLeft']>.8];right=[s for s in out['loadedTrunkProjections']if s['loadLeft']<.2]
 out['loadedSideProjectionChecks']={'leftPelvisMinX':min(s['pelvisX']for s in left),'leftRibMinX':min(s['ribCageX']for s in left),'rightPelvisMaxX':max(s['pelvisX']for s in right),'rightRibMaxX':max(s['ribCageX']for s in right)}
 assert all(out['loadedSideProjectionChecks'][k]>0 for k in ['leftPelvisMinX','leftRibMinX'])
 assert all(out['loadedSideProjectionChecks'][k]<0 for k in ['rightPelvisMaxX','rightRibMaxX'])
 (ROOT/f'{faction}-mechanics.json').write_text(json.dumps(out,indent=2)+'\n')
 print('MECHANICS',faction,out['ribCageRelativeToPelvisRangeDeg'],out['loadedSideProjectionChecks'])
