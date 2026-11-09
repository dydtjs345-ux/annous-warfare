import bpy,sys,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'));from author_sprint import fingerprint
out=[]
for f in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str(R/'source'/f'{f}_SprintReview.blend'));expected=json.loads((R/'diagnostics'/f'{f}-authored.json').read_text())['preserved_action_fingerprints'];assert all(n in bpy.data.actions and fingerprint(bpy.data.actions[n])==h for n,h in expected.items());out.append({'faction':f,'original_source_actions_preserved_after_reopen':len(expected),'passed':True})
(R/'diagnostics/source-action-preservation.json').write_text(json.dumps(out,indent=2));print('PRESERVED_SOURCE_ACTIONS',out,flush=True)
