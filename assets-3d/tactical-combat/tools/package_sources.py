import bpy,os
from pathlib import Path
root=Path(__file__).resolve().parents[1];faction=os.environ.get('AW_FACTION','USMC');path=root/'source'/f'{faction}_Tactical.blend';bpy.ops.wm.open_mainfile(filepath=str(path));r=bpy.data.objects['InfantryRig'];r.animation_data.action=None
for track in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(track)
for name in ['TC_CrawlForward_Lower','TC_CrawlForward_Upper']:
 tr=r.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,bpy.data.actions[name]);st.action_frame_start=0;st.action_frame_end=72;st.repeat=2;st.blend_type='REPLACE'
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=144;bpy.context.scene.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True);print('PACKAGED_SOURCE',faction)
