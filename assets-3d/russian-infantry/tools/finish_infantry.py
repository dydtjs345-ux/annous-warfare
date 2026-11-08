"""UV/PBR bake, real GLB+FBX export and actual Blender preview renders."""
import bpy,math,json,bmesh,os
from mathutils import Vector

def unwrap(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.008,area_weight=.1,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')

def bake(obj,root,prefix,size):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
    scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=12
    unwrap(obj);materials=list({m.name:m for m in obj.data.materials if m}.values());targets={}
    for m in materials:
        n=m.node_tree.nodes;node=n.new('ShaderNodeTexImage');node.name='EXPORT_BAKE_TARGET';node.select=True;n.active=node;targets[m.name]=node
    paths={}
    for kind in ['BaseColor','Roughness','Metallic','Normal']:
        im=bpy.data.images.new(prefix+'_'+kind,width=size,height=size,alpha=True)
        im.colorspace_settings.name='sRGB' if kind=='BaseColor' else 'Non-Color'
        im.generated_color=(.5,.5,1,1) if kind=='Normal' else (0,0,0,1)
        for m in materials:
            n=m.node_tree.nodes;links=m.node_tree.links;targets[m.name].image=im;n.active=targets[m.name]
            if kind!='Normal':
                p=n.get('Principled BSDF');out=n.get('Material Output');emit=n.new('ShaderNodeEmission');emit.name='TEMP_BAKE_EMISSION'
                inp=p.inputs[{'BaseColor':'Base Color','Roughness':'Roughness','Metallic':'Metallic'}[kind]]
                if inp.is_linked:links.new(inp.links[0].from_socket,emit.inputs['Color'])
                else:
                    val=inp.default_value;emit.inputs['Color'].default_value=tuple(val) if kind=='BaseColor' else (val,val,val,1)
                links.new(emit.outputs[0],out.inputs['Surface'])
        print('BAKE',prefix,kind,size,flush=True)
        bpy.ops.object.bake(type='NORMAL' if kind=='Normal' else 'EMIT',use_clear=True,margin=12)
        im.filepath_raw=str(root/'textures'/f'{prefix}_{kind}.png');im.file_format='PNG';im.save();paths[kind]=im
        for m in materials:
            if kind!='Normal':
                n=m.node_tree.nodes;links=m.node_tree.links;n.remove(n.get('TEMP_BAKE_EMISSION'));links.new(n.get('Principled BSDF').outputs['BSDF'],n.get('Material Output').inputs['Surface'])
    # Standard metallic/roughness material with portable image maps.
    material=bpy.data.materials.new(prefix+'_Baked_PBR');material.use_nodes=True;n=material.node_tree.nodes;l=material.node_tree.links;p=n.get('Principled BSDF')
    for kind,socket in [('BaseColor','Base Color'),('Roughness','Roughness'),('Metallic','Metallic')]:
        tex=n.new('ShaderNodeTexImage');tex.image=paths[kind];tex.label=kind;l.new(tex.outputs['Color'],p.inputs[socket])
    tex=n.new('ShaderNodeTexImage');tex.image=paths['Normal'];normal=n.new('ShaderNodeNormalMap');l.new(tex.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],p.inputs['Normal'])
    obj.data.materials.clear();obj.data.materials.append(material)
    for f in obj.data.polygons:f.material_index=0
    return paths

def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]

def glb(path,objects):
    # Copy export geometry; preserve socket parentage on the copied weapon.
    copies=[];renamed=[];exported=[];mapping={}
    try:
        for ob in objects:
            if ob.type=='ARMATURE':exported.append(ob);mapping[ob]=ob;continue
            name=ob.name;ob.name='SOURCE_'+name;renamed.append((ob,name))
            copy=ob.copy()
            if ob.data:copy.data=ob.data.copy();copy.data.name=name
            copy.name=name
            bpy.context.collection.objects.link(copy);copy.parent=None;copy.matrix_world=ob.matrix_world.copy()
            if copy.type=='MESH':
                bm=bmesh.new();bm.from_mesh(copy.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(copy.data);bm.free()
            copies.append(copy);exported.append(copy);mapping[ob]=copy
        for ob,copy in mapping.items():
            if ob.parent in mapping and ob.parent.type=='MESH':
                world=copy.matrix_world.copy();copy.parent=mapping[ob.parent];copy.matrix_world=world
        select(exported)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=False,export_tangents=True,export_animations=False,export_skins=True,export_all_influences=False,export_extras=True,export_draco_mesh_compression_enable=False)
    finally:
        for copy in copies:
            data=copy.data;bpy.data.objects.remove(copy,do_unlink=True)
            if data:bpy.data.meshes.remove(data)
        for ob,name in renamed:ob.name=name

def fbx(path,objects):
    select(objects)
    bpy.ops.export_scene.fbx(filepath=str(path),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,bake_anim=False,path_mode='COPY',embed_textures=True,axis_forward='-Z',axis_up='Y',use_armature_deform_only=True)

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()

def render_views(root,char,weapon,rig,fast=False):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24 if fast else int(os.environ.get('AW_DETAIL_SAMPLES','96'));scene.cycles.use_denoising=False
    scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    if scene.world is None:scene.world=bpy.data.worlds.new('Studio world')
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.07,.085,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object;floor.name='STUDIO_only_floor'
    m=bpy.data.materials.new('STUDIO_only_floor_material');m.diffuse_color=(.055,.068,.08,1);floor.data.materials.append(m)
    for name,loc,power,size,color in [('Key',(-3,-4,4),450,3,(1,.89,.74)),('Fill',(3,-2,3),270,3,(.74,.84,1)),('Rim',(1,3,4),550,2,(.85,.91,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name='STUDIO_'+name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1))
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='STUDIO_Camera';scene.camera=cam;cam.data.type='ORTHO'
    views=[('quarter',(3,-5,2.8),(.43,0,.94),2.8,1280,1280),('front',(0,-5,1.0),(.35,0,.94),2.8,1280,1280),('back',(2.8,5,2.5),(.25,0,.95),2.65,1280,1280),('side',(4,0,1.4),(0,0,.93),2.15,1000,1280)]
    if fast:views=views[:1]
    elif os.environ.get('AW_DETAIL_VIEWS'):views=[v for v in views if v[0] in os.environ['AW_DETAIL_VIEWS'].split(',')]
    for name,pos,target,scale,w,h in views:
        if fast:w,h=640,640
        cam.location=pos;aim(cam,target);cam.data.ortho_scale=scale;scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.filepath=str(root/'previews'/f'{name}.png');print('RENDER',name,flush=True);bpy.ops.render.render(write_still=True)
    return floor

def weapon_sockets(weapon):
    points={'attach_grip_R':(-.025,.061,-.028),'attach_support_L':(.005,-.195,.037),'attach_muzzle':(0,-.593,.081),'attach_magazine':(0,-.10,.025),'attach_stock':(0,.346,.03),'attach_bolt':(.043,-.005,.104)}
    sockets=[]
    for name,point in points.items():
        ob=bpy.data.objects.get(name)
        if ob is None:ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob)
        ob.parent=weapon;ob.location=point;ob.empty_display_type='ARROWS';ob.empty_display_size=.025
        ob['purpose']='Weapon-local attachment marker; Blender metres Z-up, forward -Y'
        sockets.append(ob)
    return sockets

def split_magazine(weapon):
    part=bpy.data.objects.get('AK74M_Magazine')
    if part:return part
    vg=weapon.vertex_groups.get('part_magazine')
    if vg is None:raise RuntimeError('Rebuild geometry to tag detachable magazine vertices')
    ids={v.index for v in weapon.data.vertices if any(g.group==vg.index for g in v.groups)}
    assert len(ids)>50
    part=weapon.copy();part.data=weapon.data.copy();bpy.context.collection.objects.link(part);part.name='AK74M_Magazine'
    for ob,keep in [(part,True),(weapon,False)]:
        bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if (v.index in ids)!=keep],context='VERTS')
        bm.to_mesh(ob.data);bm.free();ob.vertex_groups.clear()
    part.parent=weapon;part.matrix_basis.identity();part['asset_role']='Removable 30-round AK74 magazine; rigid child of replaceable weapon'
    return part

def export_assets(root,char,weapon,rig):
    magazine=split_magazine(weapon);sockets=weapon_sockets(weapon)
    weapon.rotation_euler.z=math.pi/2;bpy.context.view_layer.update()
    glb(root/'models/Russian_Infantry_Kit.glb',[char,rig,weapon,magazine,*sockets]);fbx(root/'models/Russian_Infantry_Kit.fbx',[char,rig,weapon,magazine,*sockets])
    glb(root/'models/Russian_Infantry_Apose.glb',[char,rig]);fbx(root/'models/Russian_Infantry_Apose.fbx',[char,rig])
    park=weapon.matrix_world.copy();weapon.location=(0,0,0);weapon.rotation_euler=(0,0,0);bpy.context.view_layer.update()
    glb(root/'models/AK74M.glb',[weapon,magazine,*sockets]);fbx(root/'models/AK74M.fbx',[weapon,magazine,*sockets]);weapon.matrix_world=park
    bpy.context.view_layer.update()

def finish(root,char,weapon,rig):
    pc=bake(char,root,'Russian_Infantry',2048);pw=bake(weapon,root,'AK74M',1024)
    export_assets(root,char,weapon,rig)
    for im in [*pc.values(),*pw.values()]:im.pack()
    stats={}
    for ob in [char,weapon,bpy.data.objects['AK74M_Magazine']]:
        ob.data.calc_loop_triangles();stats[ob.name]={'vertices':len(ob.data.vertices),'faces':len(ob.data.polygons),'triangles':len(ob.data.loop_triangles),'quads':sum(len(p.vertices)==4 for p in ob.data.polygons),'uv_layers':len(ob.data.uv_layers),'materials':len(ob.data.materials),'bounds_metres':list(ob.dimensions)}
    stats['bones']=len(rig.data.bones);stats['textures']={'character':2048,'weapon':1024}
    (root/'geometry-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'source/Russian_Infantry.blend'))
    render_views(root,char,weapon,rig,fast=True)
    print('RUSSIAN_EXPORTS_FINISHED',flush=True)
