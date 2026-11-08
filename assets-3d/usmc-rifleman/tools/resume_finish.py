import bpy,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
import finish_asset
finish_asset.finish(root,bpy.data.objects['USMC_Rifleman_Character'],bpy.data.objects['M16A4_Separate_Weapon'],bpy.data.objects['USMC_Rifleman_Rig'])
