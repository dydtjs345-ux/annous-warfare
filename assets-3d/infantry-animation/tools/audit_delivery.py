"""Final asset/hash, source-preservation and repository-size audit."""
import json,hashlib,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];BASE='1ab40c26b6e02fedd161b7711ecec1e7ecef71dd';MAIN='b381e6017d01fa34f14e889ff639347db9e5feae'
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO).decode().strip()
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert git('branch','--show-current')=='feat/shared-infantry-combat-animation';assert git('rev-parse','main')==MAIN
assert not git('diff','--name-only',BASE,'--','.',':(exclude)assets-3d/infantry-animation')
originals=git('ls-tree','-r',BASE,'--','assets-3d/usmc-rifleman','assets-3d/russian-infantry').splitlines()
for row in originals:
 info,path=row.split('\t',1);assert git('hash-object',path)==info.split()[2],('Original asset changed',path)
required=['README.md','REPORT.md','architecture.json','preview/index.html','preview/viewer.js','preview/vendor/three.module.js','preview/vendor/LICENSE-three.txt','review/moving-fire-120px.mp4','review/eight-directions-120px.png','review/mobile-80px.png']
for size in [60,80,120]:required.append(f'review/preview-{size}px.png')
for state in ['Walk','Sprint','Raise','Fire','AimWalk','MovingFire','Reload']:required.append(f'review/{state}-phases.png')
for direction in ['N','NE','E','SE','S','SW','W','NW']:required.append(f'review/directions/{direction}.png')
for faction in ['USMC','Russian']:
 required.extend([f'source/{faction}_Animation.blend',f'models/{faction}_Animated.glb',f'models/{faction}_MovingFire.fbx',f'validation/{faction}-authoring.json',f'validation/{faction}-deformation-gate.json',f'validation/{faction}-motion-validation.json'])
assert all((ROOT/p).is_file()and(ROOT/p).stat().st_size>0 for p in required)
gltf=read('validation/glb-validation.json');imports=read('validation/reimport-validation.json');browser=read('validation/browser-review.json');shared=read('validation/shared-motion.json')
assert len(gltf['files'])==2 and len(imports['isolated_imports'])==4
for row in gltf['files']:
 assert row['khronos']['numErrors']==0 and row['khronos']['numWarnings']==0 and len(row['animations'])==21
 assert row['sha256']==sha(ROOT/'models'/row['file'])
for row in imports['isolated_imports']:assert row['passed']and row['sha256']==sha(ROOT/'models'/row['file'])
assert browser['errors']==[] and browser['movingFire']['lowerCyclePreserved']and browser['movingFire']['repeatedRecoil']
for faction,hashvalue in browser['assetHashes'].items():assert hashvalue==sha(ROOT/'models'/f'{faction}_Animated.glb')
assert shared['exactly_equal_between_factions']and len(shared['shared_lower_action_hashes'])==12
motion={f:read(f'validation/{f}-motion-validation.json')for f in ['USMC','Russian']}
for f,j in motion.items():assert len(j['contact_transitions'])==5 and len(j['turn_orientation_commit_endpoint_errors'])==2
video=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-show_entries','stream=nb_frames,width,height','-of','json',str(ROOT/'review/moving-fire-120px.mp4')]))
assert int(video['streams'][0]['nb_frames'])==144 and abs(float(video['format']['duration'])-4.8)<.01
exclude={'SHA256SUMS','animation-validation.json'}
files=[p for p in ROOT.rglob('*')if p.is_file()and not any(t in p.parts for t in ['node_modules','__pycache__'])and p.suffix not in ['.blend1','.blend2']and p.name not in exclude]
largest=max(files,key=lambda p:p.stat().st_size);assert largest.stat().st_size<100*1024*1024
report={'status':'passed','base_commit':BASE,'branch':git('branch','--show-current'),'main_commit_unchanged':MAIN,'original_model_files_verified_against_git_blobs':len(originals),'changed_original_model_files':[],'tracked_changes_outside_new_asset_directory':[],'shared_skeleton_bones':163,'identical_lower_actions':12,'reusable_glb_clips_per_faction':21,'animated_reimports_passed':4,'max_reimport_joint_weapon_and_surface_error_m':max(x['max_source_joint_and_weapon_position_error_m']for x in imports['isolated_imports']),'max_contact_transition_support_velocity_residual_mps':max(r['max_planted_world_velocity_residual_mps']for j in motion.values()for r in j['contact_transitions'].values()),'moving_fire_lower_body_unchanged_by_recoil':True,'browser_fire_preserves_gait_phase':True,'browser_turn_completion_foot_jump_m':browser['turnCompletionMaxFootJumpMetres'],'browser_errors':[],'video':video,'required_files_present':len(required),'largest_file':str(largest.relative_to(ROOT)),'largest_file_bytes':largest.stat().st_size,'payload_bytes_before_final_manifest_and_checksums':sum(p.stat().st_size for p in files),'per_file_github_limit_pass':True,'known_limits':read('architecture.json')['limits']}
(ROOT/'validation/animation-validation.json').write_text(json.dumps(report,indent=2)+'\n')
files.append(ROOT/'validation/animation-validation.json');(ROOT/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.relative_to(ROOT)}\n'for p in sorted(files)))
print(json.dumps(report,indent=2))
