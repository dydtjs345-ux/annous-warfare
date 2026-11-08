"""Precompute idle figure framing; no large per-vertex scan on the phone."""
import bpy,sys,json,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
REPO=Path(__file__).resolve().parents[2];ROOT=REPO/'animation-preview-pages';sys.path.insert(0,str(REPO/'assets-3d/infantry-animation/tools'))
from animation_io import pose
up=(Vector((0,0,0))-Vector((6,-6,4.899))).to_track_quat('-Z','Y').to_matrix()@Vector((0,1,0))
headings={'N':225,'NE':180,'E':135,'SE':90,'S':45,'SW':0,'W':315,'NW':270};report={}
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str(REPO/'assets-3d/infantry-animation/source'/f'{faction}_Animation.blend'))
 rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];pose(rig,'Lower_Idle','Upper_LowReady',0)
 ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();xyz=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',xyz);xyz=xyz.reshape((-1,3));spans={}
 for name,degrees in headings.items():
  R=np.array(Matrix.Rotation(math.radians(degrees),3,'Z'));projected=(xyz@R.T)@np.array(up);spans[name]=float(projected.max()-projected.min())
 report[faction]=spans;ev.to_mesh_clear()
(ROOT/'src/reference-spans.json').write_text(json.dumps(report,indent=2)+'\n');print('CAMERA_SPANS_WRITTEN')
