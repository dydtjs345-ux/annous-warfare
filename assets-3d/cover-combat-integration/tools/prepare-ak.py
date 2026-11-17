"""Reuse the project AK; triangulate before tangent generation, without touching originals."""
import bpy,bmesh
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT/'source/AK74M_AimReference.blend'),link=False)as(f,t):t.objects=['Weapon','Magazine']
for o in t.objects:
 bpy.context.scene.collection.objects.link(o);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models/AK74M_Weapon.glb'),export_format='GLB',use_selection=True,export_animations=False,export_tangents=True)
