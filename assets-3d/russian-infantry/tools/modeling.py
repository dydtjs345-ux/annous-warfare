"""Shared equipment modeling helpers adapted from the USMC pipeline; EMR palette. Blender 4.3+, units in metres."""
import bpy, math, bmesh
from mathutils import Vector
CHAR=[]; WEAPON=[]

def linear(h):
    a=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)+(1,)

def material(name,color,rough=.8,metal=0,camo=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=linear(color);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    coord=n.new('ShaderNodeTexCoord')
    if camo:
        grid=n.new('ShaderNodeVectorMath');grid.operation='SCALE';grid.inputs[3].default_value=185;l.new(coord.outputs['Object'],grid.inputs[0])
        fl=n.new('ShaderNodeVectorMath');fl.operation='FLOOR';l.new(grid.outputs[0],fl.inputs[0])
        sc=n.new('ShaderNodeVectorMath');sc.operation='SCALE';sc.inputs[3].default_value=1/185;l.new(fl.outputs[0],sc.inputs[0])
        tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=32;tex.inputs['Detail'].default_value=1.0;tex.inputs['Roughness'].default_value=.65;l.new(sc.outputs[0],tex.inputs['Vector'])
        ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
        colors=[(.0,'34432B'),(.34,'465B32'),(.455,'657444'),(.54,'293425'),(.61,'252B20'),(.69,'7A8052')]
        r=ramp.color_ramp;r.elements.remove(r.elements[1]);r.elements[0].position=colors[0][0];r.elements[0].color=linear(colors[0][1])
        for pos,c in colors[1:]:r.elements.new(pos).color=linear(c)
        l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
    grain=n.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=380 if not metal else 650;grain.inputs['Detail'].default_value=2;l.new(coord.outputs['Object'],grain.inputs['Vector'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18 if not metal else .12;bump.inputs['Distance'].default_value=.0007 if not metal else .00025;l.new(grain.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
    return m

def tag(o,name,mat,bone=None,weapon=False):
    o.name=name
    if mat:o.data.materials.append(mat)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
        if bone:
            g=o.vertex_groups.new(name=bone);g.add(range(len(o.data.vertices)),1,'REPLACE')
    (WEAPON if weapon else CHAR).append(o);return o

def apply(o,modifier):
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=modifier.name);o.select_set(False)

def box(name,loc,dim,mat,bone=None,bevel=.004,weapon=False,rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dim
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rotation:o.rotation_euler=rotation
    if bevel:
        # Never let opposite bevels meet across a thin flap/rail. Blender otherwise
        # leaves collapsed middle faces which triangulate into zero-area geometry.
        b=o.modifiers.new('Tailored soft edge','BEVEL');b.width=min(bevel,min(dim)*.42);b.segments=2;apply(o,b)
        w=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');apply(o,w)
    return tag(o,name,mat,bone,weapon)

def mesh(name,verts,faces,mat,bone=None,weapon=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return tag(o,name,mat,bone,weapon)

def sphere(name,loc,scale,mat,bone=None,weapon=False,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return tag(o,name,mat,bone,weapon)

def rod(name,a,b,r,mat,bone=None,weapon=False,vertices=12,r2=None):
    a,b=Vector(a),Vector(b);mid=(a+b)/2
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=mid);o=bpy.context.object
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return tag(o,name,mat,bone,weapon)

def cord(name,points,r,mat,bone=None,weapon=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=0;c.resolution_u=1;c.use_fill_caps=True
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for v,co in zip(s.points,points):v.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);return tag(o,name,mat,bone,weapon)

def panel(name,outline,depth,mat,bone=None,curve=.0,back=False,weapon=False,vertical=0):
    # Outline is (x,z), depth is y front/back. Geometry follows a curved plate.
    y0,y1=depth;v=[]
    for y in (y0,y1):
        for x,z in outline:v.append((x,y+(curve*x*x)+vertical*max(0,z-1.28),z))
    n=len(outline);f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    for i in range(n):j=(i+1)%n;f.append((i,j,n+j,n+i))
    o=mesh(name,v,f,mat,bone,weapon);b=o.modifiers.new('Stitched softened perimeter','BEVEL');b.width=.003;b.segments=2;apply(o,b);return o

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();return o

def ribbon(name,points,width,thickness,mat,bone=None,width_axis=(1,0,0)):
    pts=[Vector(p)for p in points];side=Vector(width_axis).normalized();verts=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]).normalized();normal=tangent.cross(side).normalized()
        for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:verts.append(tuple(p+side*(a*width/2)+normal*(b*thickness/2)))
    faces=[(3,2,1,0),tuple((len(pts)-1)*4+i for i in range(4))]
    for j in range(len(pts)-1):
        for i in range(4):faces.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
    return mesh(name,verts,faces,mat,bone)
