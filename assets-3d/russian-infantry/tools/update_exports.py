"""Re-export a baked A-pose source without repeating the texture bake."""
import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_infantry import export_assets
export_assets(ROOT,bpy.data.objects['Russian_Infantry_Character'],bpy.data.objects['AK74M_Separate_Weapon'],bpy.data.objects['Russian_Infantry_Rig'])
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/Russian_Infantry.blend'))
