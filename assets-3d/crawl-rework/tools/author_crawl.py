"""Reference-informed forward crawl, on copies of the preserved shared rigs.

Only the existing TC_CrawlForward lower/upper pair is replaced. Body motion is
keyed offline; the runtime needs no procedural pose override or AI changes.
"""
import bpy,sys,os,math,json,copy,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Euler,Quaternion

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT.parent/'tactical-combat'
sys.path.insert(0,str(BASE/'tools'))
from author_tactical import Tactical,smooth,hermite,fingerprint,pose,parse_glb,write_glb
D=2.4;SPEED=.23;TAU=math.tau
PAIR=['TC_CrawlForward_Lower','TC_CrawlForward_Upper']

class Crawl(Tactical):
 def __init__(self,faction):
  super().__init__(faction)
  # Append preserved tactical Actions, excluding only the pair being revised.
  with bpy.data.libraries.load(str(BASE/'source'/f'{faction}_Tactical.blend'))as(src,dst):
   dst.actions=[n for n in src.actions if n.startswith('TC_')and n not in PAIR]
  self.original={ac.name:fingerprint(ac)for ac in bpy.data.actions}
  self.contact_samples=[];self.max_shoulder_adjustment=0
  self.regions={}
  for side in ['L','R']:
   ids={g.index for g in self.char.vertex_groups if g.name.startswith(('lowerarm01.'+side,'lowerarm02.'+side))}
   self.regions[side]=[v.index for v in self.char.data.vertices if any(g.group in ids and g.weight>.5 for g in v.groups)]

 def stroke(self,p,side,phase_offset=0):
  """A 50% forearm plant followed by a smooth, low recovery.

  During plant local Y increases at SPEED, exactly cancelling actor travel -Y.
  The recovery uses a Hermite curve with matching endpoint velocities.
  """
  u=(p+phase_offset)%1;sign=1 if side=='L'else-1
  front=-.59;rear=front+SPEED*D*.5
  if u<=.5:y=front+SPEED*D*u;lift=0
  else:
   q=(u-.5)/.5;y=hermite(rear,front,SPEED*D*.5,SPEED*D*.5,q);lift=.065*math.sin(math.pi*q)**2
  return u,Vector((sign*.32,y,(.062 if side=='L'else .047)+lift)),lift

 def body(self,t):
  p=(t/D)%1;s=math.sin(TAU*p);c=math.cos(TAU*p)
  # Support arc: the chest passes over an elbow, with a low pelvic roll/yaw.
  u=p%.5;dy=SPEED*D*(u-.25)
  support_height=.063+math.sqrt(.259**2-.10**2-dy**2)
  self.setup(.33,91+1.4*math.cos(2*TAU*p),t,.018*s,roll=3.8*s,yaw=4.5*s,rooty=.018*math.sin(2*TAU*p))
  for n,k in [('spine05',.27),('spine04',.23),('spine03',.20),('spine02',.17),('spine01',.13)]:
   self.rot(n,-2*k+1.8*k*math.cos(2*TAU*p),-3.0*k*s,-5.6*k*math.sin(TAU*p-.22))
  self.rot('clavicle.L',1.8*s,0,2.8*c)
  self.rot('clavicle.R',-1.8*s,0,-2.8*c)
  # Root height follows the support arc; shoulder offsets account for natural
  # girdle reach while the torso, neck and pelvic frame remain coordinated.
  average=sum(self.a.bones['upperarm01.'+side].head.z for side in ['L','R'])/2
  root=self.a.bones['root'];M=root.matrix.copy();M.translation.z+=support_height-average;root.matrix=M;self.a.update()
  for n,x in [('neck01',-17),('neck02',-14),('neck03',-12)]:self.rot(n,x,0,0)
  head=self.a.bones['head'];q=Euler((math.radians(12),0,math.radians(1.4*math.sin(TAU*p-.25))),'XYZ').to_quaternion()@self.headQ
  head.matrix=Matrix.Translation(head.head)@q.to_matrix().to_4x4();self.a.update()
  return p

 def arm_at(self,side,elbow,wrist,R):
  a=self.a;shoulder=a.bones['upperarm01.'+side].head.copy()
  s0=a.rest['upperarm01.'+side].translation;e0=a.rest['lowerarm01.'+side].translation;w0=a.rest['wrist.'+side].translation
  upper=(e0-s0).length;fore=(w0-e0).length
  # Small, anatomically useful shoulder-girdle protraction makes the planted
  # elbow compatible with fixed limb lengths. No upper/lower arm bone stretch.
  v=shoulder-elbow;wanted=elbow+v.normalized()*upper;delta=wanted-shoulder
  self.max_shoulder_adjustment=max(self.max_shoulder_adjustment,delta.length)
  clavicle=a.bones['clavicle.'+side];M=clavicle.matrix.copy();M.translation+=delta;clavicle.matrix=M;a.update()
  shoulder=a.bones['upperarm01.'+side].head.copy()
  assert abs((shoulder-elbow).length-upper)<1e-5
  assert abs((wrist-elbow).length-fore)<1e-5
  a.rigid('upperarm01.'+side,(e0-s0).rotation_difference(elbow-shoulder).to_matrix(),s0,shoulder)
  a.rigid('lowerarm01.'+side,(w0-e0).rotation_difference(wrist-elbow).to_matrix(),e0,elbow)
  a.rigid('wrist.'+side,R,w0,wrist)

 def leg_at(self,side,goal,R):
  # The shared helper's 85 mm knee clearance was deliberately conservative.
  # For this low crawl, solve against the padded knee's actual 64 mm center.
  a=self.a;start='upperleg01.'+side;mid='lowerleg01.'+side;end='foot.'+side
  h=a.bones[start].head.copy();h0=a.rest[start].translation;k0=a.rest[mid].translation;e0=a.rest[end].translation;l1=(k0-h0).length;l2=(e0-k0).length
  v=goal-h;d=v.length;assert abs(l1-l2)+.001<d<l1+l2-.0002
  axis=v/d;x=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-x*x));hint=Vector(((1 if side=='L'else-1)*.36,.08,.02));pole=hint-(h+axis*x);pole=(pole-axis*pole.dot(axis)).normalized()
  if h.z+axis.z*x+pole.z*height<.064:
   up=Vector((0,0,1));up=(up-axis*up.dot(axis)).normalized();cross=axis.cross(up).normalized();c=max(-1,min(1,(.064-h.z-axis.z*x)/max(1e-8,height*up.z)));sign=1 if pole.dot(cross)>=0 else-1;pole=up*c+cross*sign*math.sqrt(max(0,1-c*c))
  knee=h+axis*x+pole*height
  a.rigid(start,(k0-h0).rotation_difference(knee-h).to_matrix(),h0,h);a.rigid(mid,(e0-k0).rotation_difference(goal-knee).to_matrix(),k0,knee);a.rigid(end,R,e0,goal)
  return knee

 def crawl(self,t,measure=False):
  p=self.body(t);a=self.a;sample={'time':t,'arms':{},'feet':{}}
  for n,M in self.fingers.items():a.bones[n].matrix_basis=M
  for side,offset in [('L',0),('R',.5)]:
   u,elbow,lift=self.stroke(p,side,offset)
   # The weapon stays controlled by the dominant hand while the support hand
   # is deliberately free for the entire crawl. The right forearm pulls low.
   fore=(a.rest['wrist.'+side].translation-a.rest['lowerarm01.'+side].translation).length
   dz=.103 if side=='R'else .015
   dx=.035 if side=='R'else-.035
   wrist=elbow+Vector((dx,-math.sqrt(fore*fore-dz*dz-dx*dx),dz))
   if side=='R':
    Wrot=Euler((math.radians(2),math.radians(3*math.sin(TAU*p)),math.radians(4)),'XYZ').to_quaternion()@self.aimR
    R=(Wrot.to_matrix().to_4x4()@self.hand['R']).to_3x3()@a.rest['wrist.R'].to_3x3().inverted()
   else:
    _,_,frame=a.hand_frame('L');desired=Matrix((Vector((-1,0,0)),Vector((0,-1,0)),Vector((0,0,1)))).transposed();R=desired@frame.transposed()
   self.arm_at(side,elbow,wrist,R)
   if side=='L':
    for n in self.upperBones:
     if n.endswith('.L')and n.startswith(('finger','metacarpal')):a.bones[n].rotation_quaternion=Quaternion()
   a.update();sample['arms'][side]={'stance':u<=.5,'phase':u,'elbow':list(a.bones['lowerarm01.'+side].head),'wrist':list(a.bones['wrist.'+side].head)}
  for side,offset,sign in [('L',.5,1),('R',0,-1)]:
   u=(p+offset)%1;duty=.60;front=.405;rear=front+SPEED*D*duty
   if u<=duty:y=front+SPEED*D*u;lift=0;spread=0
   else:
    q=(u-duty)/(1-duty);y=hermite(rear,front,SPEED*D*(1-duty),SPEED*D*(1-duty),q);lift=.025*math.sin(math.pi*q)**2;spread=.045*math.sin(math.pi*q)**2
   R=Matrix.Rotation(math.radians(112),3,'X');z=.004-min((R@v).z for v in self.boots[side])+lift
   goal=Vector((sign*(.18+spread),y,z))
   # Solve a low, outward knee, allowing its padded surface to reach the floor.
   knee=self.leg_at(side,goal,R)
   sample['feet'][side]={'stance':u<=duty,'phase':u,'ankle':list(goal),'knee':list(knee)}
  a.update()
  if measure:self.contact_samples.append(sample)

 def build(self):
  self.record('CrawlForward',D,True,lambda t:self.crawl(t,True),{'speed_mps':SPEED,'support_hand':'left free for ground support; dominant right grip continuous','revision':'reference-crawl-1'})
  assert all(fingerprint(bpy.data.actions[n])==h for n,h in self.original.items()),'Other action modified'
  self.char.hide_viewport=False;self.crawl(0);bpy.context.scene.render.fps=30;bpy.ops.file.pack_all()
  bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{self.faction}_CrawlRework.blend'),compress=True)
  self.export_revision()
  out={'faction':self.faction,'actions':self.info,'samples':self.metrics['samples'],'contactTargets':self.contact_samples,'maxShoulderGirdleAdjustmentM':self.max_shoulder_adjustment,'preservedActionFingerprints':self.original}
  (ROOT/'validation'/f'{self.faction}-authored.json').write_text(json.dumps(out,indent=2)+'\n')

 def export_revision(self):
  for ob in [self.rig,self.mag,self.spare]:
   ob.animation_data.action=None
   for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
  for name in PAIR:
   tr=self.rig.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,self.actions[name]);st.action_frame_start=0;st.action_frame_end=72;tr.mute=True
  bpy.ops.object.select_all(action='DESELECT')
  for ob in [self.rig,self.char,self.weapon,self.mag,self.spare,*[o for o in self.weapon.children if o.type=='EMPTY']]:ob.select_set(True)
  bpy.context.view_layer.objects.active=self.rig
  tmp=ROOT/'models'/f'{self.faction}_CrawlTracks.glb'
  bpy.ops.export_scene.gltf(filepath=str(tmp),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=False,export_extras=True)
  j,binary=parse_glb(tmp);base,oldbin=parse_glb(BASE/'models'/f'{self.faction}_Tactical.glb');merged=bytearray(oldbin);accessors={};views={};nodeids={n['name']:i for i,n in enumerate(base['nodes'])if'name'in n}
  # Small reusable animation-only GLB for the preview; geometry/textures are
  # loaded once from the preserved model and shared by the comparison actors.
  patch={'asset':{'version':'2.0','generator':'Autonomous Warfare reference crawl'},'scene':j.get('scene',0),'scenes':copy.deepcopy(j['scenes']),'nodes':copy.deepcopy(j['nodes']),'animations':[],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]};pb=bytearray();pam={};pvm={}
  for n in patch['nodes']:
   for key in ['mesh','skin','camera']:n.pop(key,None)
  def pa(index):
   if index in pam:return pam[index]
   ac=copy.deepcopy(j['accessors'][index]);vi=ac['bufferView']
   if vi not in pvm:
    v=copy.deepcopy(j['bufferViews'][vi]);start=v.get('byteOffset',0);pb.extend(b'\0'*((-len(pb))%4));v['byteOffset']=len(pb);v['buffer']=0;pb.extend(binary[start:start+v['byteLength']]);pvm[vi]=len(patch['bufferViews']);patch['bufferViews'].append(v)
   ac['bufferView']=pvm[vi];pam[index]=len(patch['accessors']);patch['accessors'].append(ac);return pam[index]
  for animation in j['animations']:
   anim=copy.deepcopy(animation);allowed=set(self.info[anim['name']]['bones']);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed];used=sorted({c['sampler']for c in anim['channels']});mp={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][i]for i in used]
   for sampler in anim['samplers']:sampler['input']=pa(sampler['input']);sampler['output']=pa(sampler['output'])
   for channel in anim['channels']:channel['sampler']=mp[channel['sampler']]
   patch['animations'].append(anim)
  patch['buffers'][0]['byteLength']=len(pb);write_glb(ROOT/'models'/f'{self.faction}_CrawlForward.animation.glb',patch,bytes(pb))
  def accessor(index):
   if index in accessors:return accessors[index]
   ac=copy.deepcopy(j['accessors'][index]);vi=ac['bufferView']
   if vi not in views:
    v=copy.deepcopy(j['bufferViews'][vi]);start=v.get('byteOffset',0);merged.extend(b'\0'*((-len(merged))%4));v['byteOffset']=len(merged);v['buffer']=0;merged.extend(binary[start:start+v['byteLength']]);views[vi]=len(base['bufferViews']);base['bufferViews'].append(v)
   ac['bufferView']=views[vi];accessors[index]=len(base['accessors']);base['accessors'].append(ac);return accessors[index]
  for anim in j['animations']:
   assert anim['name']in PAIR
   allowed=set(self.info[anim['name']]['bones']);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed];used=sorted({c['sampler']for c in anim['channels']});mapping={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][i]for i in used]
   for sampler in anim['samplers']:sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
   for channel in anim['channels']:channel['sampler']=mapping[channel['sampler']];channel['target']['node']=nodeids[j['nodes'][channel['target']['node']]['name']]
   index=next(i for i,v in enumerate(base['animations'])if v['name']==anim['name']);base['animations'][index]=anim
  base['buffers'][0]['byteLength']=len(merged);base.setdefault('extras',{})['crawl_revision']='reference-crawl-1'
  write_glb(ROOT/'models'/f'{self.faction}_CrawlRework.glb',base,bytes(merged));tmp.unlink()

if __name__=='__main__':Crawl(os.environ.get('AW_FACTION','USMC')).build()
