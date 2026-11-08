"""Re-export baked meshes after exporter-only fixes; geometry/textures stay intact."""
import bpy, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_asset import glb
char=bpy.data.objects['USMC_Rifleman_Character'];rig=bpy.data.objects['USMC_Rifleman_Rig'];weapon=bpy.data.objects['M16A4_Separate_Weapon']
glb(ROOT/'models/USMC_Rifleman_Kit.glb',[char,rig,weapon])
glb(ROOT/'models/USMC_Rifleman_Apose.glb',[char,rig])
weapon.location=(0,0,0);weapon.rotation_euler=(0,0,0)
glb(ROOT/'models/M16A4.glb',[weapon])
print('THREE_GLB_EXPORTS_COMPLETE',flush=True)
