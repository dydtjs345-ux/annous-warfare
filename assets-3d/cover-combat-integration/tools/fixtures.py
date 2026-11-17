"""Parametric cover descriptors, metres/Z-up/forward -Y; no wall-model dependency."""
import bpy
from mathutils import Vector

def boxes(style='Corner',stance='Stand',side=1):
 if style in ['Corner','BlindCorner']:
  return [{'name':'Building face','min':[-1.4 if side>0 else -.24,-1.12,0],'max':[.24 if side>0 else 1.4,-.90,2.10]}, {'name':'Building return','min':[.02 if side>0 else -.24,-2.60,0],'max':[.24 if side>0 else -.02,-1.12,2.10]}]
 return [{'name':'Low barrier'if stance=='Crouch'else'Waist-high wall','min':[-1.20,-1.12,0],'max':[1.20,-.90,.90 if stance=='Crouch'else 1.14]}]
def create(style='Corner',stance='Stand',side=1):
 result=[]
 for spec in boxes(style,stance,side):
  low,high=Vector(spec['min']),Vector(spec['max']);bpy.ops.mesh.primitive_cube_add(size=1,location=(low+high)/2);o=bpy.context.object;o.name=spec['name'];o.dimensions=high-low;mat=bpy.data.materials.new(o.name+' concrete');mat.diffuse_color=(.24,.29,.31,1);o.data.materials.append(mat);result.append(o)
 return result
