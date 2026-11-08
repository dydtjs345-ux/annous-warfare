import bpy,sys,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from animation_io import export_glb
export_glb(os.environ.get('AW_FACTION','Russian'))
