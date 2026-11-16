"""Source-derived forefoot contact locking; authored motion remains the foundation.

Stance is detected from authored ball-joint height. Horizontal stance position
is fixed. Swing keeps its source path plus a continuous correction connecting
successive contacts; it is not a synthesized gait. All units are source metres.
"""
import math
from mathutils import Vector

def make_plan(apply_source,action,duration,fps,point):
 count=round(duration*fps);samples=[]
 for i in range(count+1):
  apply_source(action,i/fps);samples.append({side:point('ball_'+s).copy()for side,s in [('Left','l'),('Right','r')]})
 delta={side:samples[-1][side]-samples[0][side]for side in ['Left','Right']};states={};summary={}
 def raw(side,t):
  cycle=math.floor(t/duration);phase=(t-cycle*duration)*fps;i=min(count-1,int(phase));k=phase-i
  return samples[i][side].lerp(samples[i+1][side],k)+delta[side]*cycle
 def velocity(side,t):return(raw(side,t+1/fps)-raw(side,t-1/fps))*(fps/2)
 for side in ['Left','Right']:
  floor=min(s[side].z for s in samples);flags=[s[side].z<=floor+.003 for s in samples[:-1]]
  flags=[sum(flags[(i+j)%count]for j in range(-3,4))>=4 for i in range(count)]
  starts=[i/fps for i in range(count)if flags[i]and not flags[(i-1)%count]];runs=[]
  for start in starts:
   i=round(start*fps);n=0
   while n<count and flags[(i+n)%count]:n+=1
   runs.append((start,start+n/fps))
  states[side]={'floor':floor,'flags':flags,'runs':runs,'allContact':all(flags)}
  summary[side]={'sourceForefootHeightFloorM':floor,'contactIntervalsS':runs,'continuousContact':all(flags),'sourceCycleTravelM':list(delta[side]),'sourceContactThresholdM':floor+.003}
 def at(side,t):
  state=states[side]
  if state['allContact']:return samples[0][side].copy()+delta[side]*(t/duration),True
  assert state['runs'],'No source contacts for '+side
  cycle=math.floor(t/duration);intervals=[(a+k*duration,b+k*duration)for k in range(cycle-2,cycle+3)for a,b in state['runs']];intervals.sort()
  for a,b in intervals:
   if a<=t<b:return raw(side,a),True
  prev=max((p for p in intervals if p[1]<=t),key=lambda p:p[1]);next_=min((p for p in intervals if p[0]>t),key=lambda p:p[0]);a=prev[1];b=next_[0];length=b-a;u=(t-a)/length
  c0=raw(side,prev[0])-raw(side,a);c1=Vector((0,0,0));m0=-velocity(side,a);m1=-velocity(side,b)
  correction=(2*u**3-3*u*u+1)*c0+(u**3-2*u*u+u)*length*m0+(-2*u**3+3*u*u)*c1+(u**3-u*u)*length*m1
  p=raw(side,t);p.x+=correction.x;p.y+=correction.y;return p,False
 return at,summary
