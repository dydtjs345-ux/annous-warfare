"""Authored foot-contact transitions, baked into the shared lower-body Actions.
World plant anchors stay fixed while the documented root travel changes speed.
"""
import math
from mathutils import Vector,Matrix

def ease(u):u=max(0,min(1,u));return u*u*(3-2*u)
def hermite(a,b,va,vb,u,T):return a*(2*u**3-3*u*u+1)+va*T*(u**3-2*u*u+u)+b*(-2*u**3+3*u*u)+vb*T*(u**3-u*u)
def cfg(kind):return {'Idle':(0,2.4),'Walk':(1.05,1.2),'Sprint':(3,.8)}[kind]
def sample(author,kind,t):
 author.reset();author.lower_pose(kind,t,cfg(kind)[1]);root=author.bones['root'].matrix.copy();feet={}
 for side in ['L','R']:
  p=author.bones['foot.'+side];R=(p.matrix@author.rest[p.name].inverted()).to_3x3();pitch=math.atan2(R[2][1],R[1][1]);pivot=author.support_point(side,R)
  feet[side]={'point':p.head.copy(),'pitch':pitch,'base':p.head.y-pivot.y+(R@pivot).y}
 return root,feet

def author_contact_transition(a,name,before,after,T):
 v0,_=cfg(before);v1,_=cfg(after);r0,f0=sample(a,before,0);r1,f1=sample(a,after,0);r0d,f0d=sample(a,before,.001);r1d,f1d=sample(a,after,.001)
 rootv0=(r0d.translation-r0.translation)/.001;rootv1=(r1d.translation-r1.translation)/.001
 if before=='Idle':Dend=f1['R']['base']-f0['R']['base']
 elif before=='Walk'and after=='Idle':Dend=f1['L']['base']-f0['L']['base']
 else:Dend=(v0+v1)*T/2
 def travel(t):return hermite(0.,Dend,v0,v1,t/T,T)
 def pitch_stance(p0,p1,u):return p0+(p1-p0)*ease(u)
 def stance(side,anchor,pitch,t,x=None):
  R=Matrix.Rotation(pitch,3,'X');pivot=a.support_point(side,R)
  y=anchor+travel(t)+pivot.y-(R@pivot).y;z=.003-min((R@p).z for p in a.boots[side]);return Vector((f0[side]['point'].x if x is None else x,y,z)),pitch
 def flight(side,t,start,end,P0,P1,p0,p1,V0=None,V1=None,lift=.09):
  u=max(0,min(1,(t-start)/(end-start)));dt=end-start;V0=V0 if V0 is not None else Vector();V1=V1 if V1 is not None else Vector()
  world=hermite(P0,P1,V0,V1,u,dt);pitch=p0+(p1-p0)*ease(u)+math.radians(9)*math.sin(math.pi*u);R=Matrix.Rotation(pitch,3,'X')
  floor=.003-min((R@p).z for p in a.boots[side]);world.z=max(floor,world.z+lift*math.sin(math.pi*u)**1.35);world.y+=travel(t);return world,pitch
 def endpoint(side,final=False):
  p=(f1 if final else f0)[side]['point'].copy()
  if final:p.y-=Dend
  return p
 def initial_velocity(side):
  v=(f0d[side]['point']-f0[side]['point'])/.001;v.y-=v0;return v
 def final_velocity(side):
  v=(f1d[side]['point']-f1[side]['point'])/.001;v.y-=v1;return v
 def endpoint_stance(side,time,pitch):return stance(side,f0[side]['base'],pitch,time)[0]-Vector((0,travel(time),0))
 action=a.begin(name);a.previous={};plants=[];travel_samples=[]
 for frame in range(round(T*30)+1):
  t=frame/30;u=t/T;a.reset();l0,q0,s0=r0.decompose();l1,q1,s1=r1.decompose();loc=hermite(l0,l1,rootv0,rootv1,u,T);loc.z+=.018*math.sin(2*math.pi*u)**2
  a.bones['root'].matrix=Matrix.LocRotScale(loc,q0.slerp(q1,ease(u)),Vector((1,1,1)));a.update();flags={}
  for side in ['L','R']:
   planted=False
   if before=='Idle':
    if side=='R':P,pitch=stance(side,f0[side]['base'],0,t);planted=True
    else:P,pitch=flight(side,t,0,T,endpoint(side),endpoint(side,True),f0[side]['pitch'],f1[side]['pitch'],initial_velocity(side),final_velocity(side),.085)
   elif before=='Walk'and after=='Idle':
    if side=='L':pitch=pitch_stance(f0[side]['pitch'],0,min(1,u/.30));P,pitch=stance(side,f0[side]['base'],pitch,t);planted=True
    else:P,pitch=flight(side,t,0,T,endpoint(side),endpoint(side,True),f0[side]['pitch'],f1[side]['pitch'],initial_velocity(side),final_velocity(side),.08)
   elif before=='Sprint'and after=='Idle':
    takeoff=.275*T;landing=.475*T
    if side=='L':
     if t<=takeoff:
      p=pitch_stance(f0[side]['pitch'],0,min(1,t/(takeoff*.45)))+math.radians(18)*ease((t-takeoff*.55)/(takeoff*.45));P,pitch=stance(side,f0[side]['base'],p,t);planted=True
     else:
      P0=endpoint_stance(side,takeoff,math.radians(18));P,pitch=flight(side,t,takeoff,T,P0,endpoint(side,True),math.radians(18),f1[side]['pitch'],None,final_velocity(side),.08)
    else:
     anchor=f1[side]['base']-Dend
     if t<landing:
      landingP,_=stance(side,anchor,0,landing,f1[side]['point'].x);landingP.y-=travel(landing);P,pitch=flight(side,t,0,landing,endpoint(side),landingP,f0[side]['pitch'],0,initial_velocity(side),None,.035)
     else:P,pitch=stance(side,anchor,0,t,f1[side]['point'].x);planted=True
   else:
    # Two coordinated steps while changing gait; endpoints match the next loop at phase zero.
    left_to=(.36 if before=='Walk'else .26)*T;right_to=.09*T;right_land=(.50 if before=='Walk'else .35)*T;right_recover=.76*T
    anchorR=-travel(right_land)-.39
    if side=='L':
     if t<=left_to:
      p=pitch_stance(f0[side]['pitch'],0,min(1,t/(left_to*.5)))+math.radians(18)*ease((t-left_to*.55)/(left_to*.45));P,pitch=stance(side,f0[side]['base'],p,t);planted=True
     else:
      P0=endpoint_stance(side,left_to,math.radians(18));P,pitch=flight(side,t,left_to,T,P0,endpoint(side,True),math.radians(18),f1[side]['pitch'],None,final_velocity(side),.12)
    elif before=='Walk'and t<right_to:
     p=math.radians(18)*ease(t/right_to);P,pitch=stance(side,f0[side]['base'],p,t);planted=True
    elif t<right_land:
     if before=='Walk':P0=endpoint_stance(side,right_to,math.radians(18));start=right_to;p0=math.radians(18);V0=None
     else:P0=endpoint(side);start=0;p0=f0[side]['pitch'];V0=initial_velocity(side)
     landingP,_=stance(side,anchorR,0,right_land);landingP.y-=travel(right_land);P,pitch=flight(side,t,start,right_land,P0,landingP,p0,0,V0,None,.10)
    elif t<=right_recover:
     p=math.radians(18)*ease((t-(right_recover-.08*T))/(.08*T));P,pitch=stance(side,anchorR,p,t);planted=True
    else:
     P0,_=stance(side,anchorR,math.radians(18),right_recover);P0.y-=travel(right_recover);P,pitch=flight(side,t,right_recover,T,P0,endpoint(side,True),math.radians(18),f1[side]['pitch'],None,final_velocity(side),.08)
   if frame==round(T*30) and (after!='Sprint' or side=='L'):planted=True
   a.chain(side,P,Matrix.Rotation(pitch,3,'X'),free=not planted,control=True);flags[side]={'stance':planted,'pitch':pitch,'ankle':list(P)}
  a.key(a.lower,frame);plants.append({'t':t,'feet':flags});travel_samples.append({'t':t,'distance_m':travel(t)})
 a.finish_action(action,name,T,'lower',False,{'speed_mps':v1,'entry_gait':before,'entry_phase':0,'exit_gait':after,'exit_phase':0,'plant_samples':plants,'travel_samples_m':travel_samples,'root_travel_end_m':Dend,'contact_authored':True,'entry_speed_mps':v0,'exit_speed_mps':v1})
