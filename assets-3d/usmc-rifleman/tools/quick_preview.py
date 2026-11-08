import bpy,sys,math
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
import finish_asset
bpy.data.objects['M16A4_Separate_Weapon'].rotation_euler.z=math.pi/2
finish_asset.render_views(root,bpy.data.objects['USMC_Rifleman_Character'],bpy.data.objects['M16A4_Separate_Weapon'],bpy.data.objects['USMC_Rifleman_Rig'],fast=True)
