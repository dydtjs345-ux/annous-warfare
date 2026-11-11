"""Contact-phase full-body crawl on preserved infantry rigs.

Original and previous revisions remain separate. Only the existing crawl pair
is replaced in these new asset copies. Source axes: Z up, -Y forward, +X left.
"""
import bpy,sys,os,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Euler
ROOT=Path(__file__).resolve().parents[1]
PREVIOUS=ROOT.parent/'crawl-rework'
sys.path.insert(0,str(PREVIOUS/'tools'))
import author_crawl as previous
previous.ROOT=ROOT  # Output override only; the previous source files stay intact.

def curve(p,keys):
 """Periodic C1 Hermite poses indexed by contact phase, not random oscillation."""
 p=p%1;keys=list(keys);points=keys[:-1];n=len(points)
 for i,(t0,y0)in enumerate(points):
  t1,y1=keys[i+1]
  if t0<=p<t1:
   tp,yp=points[(i-1)%n];tn,yn=points[(i+2)%n]
   if i==0:tp-=1
   if i+2>=n:tn+=1
   m0=(y1-yp)/(t1-tp);m1=(yn-y0)/(tn-t0);u=(p-t0)/(t1-t0);dt=t1-t0
   return previous.hermite(y0,y1,m0*dt,m1*dt,u)
 raise ValueError(p)

LOAD=[(0,.5),(.10,.91),(.25,1),(.40,.91),(.5,.5),(.60,.09),(.75,0),(.90,.09),(1,.5)]
PELVIS_YAW=[(0,4),(.12,1),(.25,-5),(.40,-6),(.5,-4),(.62,-1),(.75,5),(.90,6),(1,4)]
CHEST_YAW=[(0,-4),(.10,-6),(.25,2),(.40,7),(.5,4),(.60,6),(.75,-2),(.90,-7),(1,-4)]
SCAPULA=[(0,-.012),(.10,-.021),(.25,.003),(.42,.024),(.5,.016),(.65,.005),(.85,-.012),(1,-.012)]
PITCH=[(0,0),(.12,-.7),(.28,.8),(.42,.4),(.5,0),(.62,-.7),(.78,.8),(.92,.4),(1,0)]

class Transfer(previous.Crawl):
 def __init__(self,faction):
  super().__init__(faction)
  self.body_samples=[]

 def body(self,t):
  p=(t/previous.D)%1;load=max(0,min(1,curve(p,LOAD)));signed=2*load-1
  pelvis_yaw=curve(p,PELVIS_YAW);chest_yaw=curve(p,CHEST_YAW)
  # Contralateral support: pelvis banks toward the pushing leg while the rib
  # cage loads the supporting forearm. The trunk projection moves arm-side.
  pelvis_roll=-5.5*(2*curve(p-.02,LOAD)-1)
  chest_roll=4.5*(2*curve(p+.02,LOAD)-1)
  self.setup(.360+.004*curve(p,PITCH),91+curve(p,PITCH),t,.034*signed,roll=pelvis_roll,yaw=pelvis_yaw,rooty=.027)
  # Distinct lumbar side flexion and thoracic turn, through deform joints.
  yaw_delta=chest_yaw-pelvis_yaw;roll_delta=chest_roll-pelvis_roll
  for n,wy,wr,wx,bend in [('spine05',.40,.18,.22,.65),('spine04',.32,.27,.25,.35),('spine03',.16,.30,.23,-.20),('spine02',.10,.20,.20,-.55),('spine01',.02,.05,.10,-.25)]:
   # A small S-shaped waist flex shifts the rib cage over support without
   # forcing its heading to remain locked to the pelvic heading.
   self.rot(n,(-2+curve(p+.05,PITCH))*wx,roll_delta*wr,yaw_delta*wy+5*signed*bend)
  for side,offset,sign in [('L',0,1),('R',.5,-1)]:
   reach=curve(p+offset,SCAPULA)
   self.rot('clavicle.'+side,0,sign*1.5*signed,-sign*reach*150)
   self.rot('shoulder01.'+side,0,sign*1.2*signed,-sign*reach*80)
   b=self.a.bones['clavicle.'+side];M=b.matrix.copy();M.translation.y+=reach;b.matrix=M;self.a.update()
  # Keep the pelvis low during propulsion. The girdle/arm solve retains the
  # fixed elbow contacts; it does not lift the whole torso onto an arm arc.
  for n,x in [('neck01',-17),('neck02',-14),('neck03',-12)]:self.rot(n,x,0,0)
  head=self.a.bones['head'];q=Euler((math.radians(12),0,math.radians(chest_yaw*.16)),'XYZ').to_quaternion()@self.headQ
  head.matrix=Matrix.Translation(head.head)@q.to_matrix().to_4x4();self.a.update()
  return p

 def crawl(self,t,measure=False):
  super().crawl(t,measure)
  if measure:
   names=['root','pelvis.L','pelvis.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','shoulder01.L','shoulder01.R','upperarm01.L','upperarm01.R','head']
   self.body_samples.append({'time':t,'loadLeft':max(0,min(1,curve(t/2.4,LOAD))),'bones':{n:{'position':list(self.a.bones[n].head),'quaternion':list(self.a.bones[n].matrix.to_quaternion()),'localQuaternion':list(self.a.bones[n].rotation_quaternion)}for n in names}})

 def build(self):
  super().build()
  p=ROOT/'validation'/f'{self.faction}-authored.json';x=json.loads(p.read_text());x['bodySamples']=self.body_samples;x['revision']='crawl-torso-2';x['mechanics']='Contact-phase load, pelvic turn, lumbar lateral flexion, independent thoracic turn and scapular reach/retraction. No random motion or runtime pose overrides.'
  for info in x['actions'].values():info['revision']='crawl-torso-2'
  p.write_text(json.dumps(x,indent=2)+'\n')

 def export_revision(self):
  super().export_revision()
  for suffix in ['CrawlRework.glb','CrawlForward.animation.glb']:
   path=ROOT/'models'/f'{self.faction}_{suffix}';j,b=previous.parse_glb(path);j.setdefault('extras',{})['crawl_revision']='crawl-torso-2';previous.write_glb(path,j,b)

if __name__=='__main__':Transfer(os.environ.get('AW_FACTION','USMC')).build()
