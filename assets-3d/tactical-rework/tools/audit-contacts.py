"""Read-only mesh contact audit of the preserved Blender tactical sources.

Labels use the largest source skin weight at each vertex. They identify which
body regions approach the floor, not contact forces, true center of mass or a
complete biomechanical balance test. No Actions or files are saved by Blender.
"""
import bpy
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT.parent / 'tactical-combat'
CACHE = Path(os.environ.get('AW_SOURCE_CACHE', str(ROOT.parents[1] / '.cache/tactical-source/assets-3d')))
sys.path.insert(0, str(CACHE / 'infantry-animation/tools'))
from animation_io import pose

ACTIONS = ['SprintProne', 'CrawlForward', 'CrouchWalk', 'ProneStand', 'CoverEnter', 'CoverExit']
out = {'scope': 'Region minimum evaluated mesh height and vertices within 15 mm of flat ground. Not a force or center-of-mass simulation.', 'factions': []}


def region(bone):
    side = bone[-1] if bone.endswith(('.L', '.R')) else ''
    if bone.startswith(('foot.', 'toe')):
        return 'boot.' + side
    if bone.startswith(('upperleg', 'lowerleg')):
        return 'leg.' + side
    if bone.startswith(('wrist.', 'finger', 'metacarpal')):
        return 'hand.' + side
    if bone.startswith(('upperarm', 'lowerarm')):
        return 'arm.' + side
    return 'torso-or-head'


for faction in ['USMC', 'Russian']:
    bpy.ops.wm.open_mainfile(filepath=str(BASE / 'source' / (faction + '_Tactical.blend')))
    rig = bpy.data.objects['InfantryRig']
    char = bpy.data.objects[faction + '_Character']
    authored = json.loads((BASE / 'validation' / (faction + '-authored.json')).read_text())
    labels = []
    for vertex in char.data.vertices:
        largest = max(vertex.groups, key=lambda g: g.weight)
        labels.append(region(char.vertex_groups[largest.group].name))
    entry = {'faction': faction, 'actions': []}
    for action in ACTIONS:
        duration = authored['actions']['TC_' + action + '_Lower']['duration']
        frames = []
        for frame in range(round(duration * 30) + 1):
            time = frame / 30
            pose(rig, 'TC_' + action + '_Lower', 'TC_' + action + '_Upper', time)
            evaluated = char.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh()
            minimum = {}
            close = {}
            for vertex, label in zip(mesh.vertices, labels):
                point = char.matrix_world @ vertex.co
                minimum[label] = min(minimum.get(label, float('inf')), point.z)
                if point.z <= .015:
                    close[label] = close.get(label, 0) + 1
            evaluated.to_mesh_clear()
            frames.append({'time': time, 'regionMinimumHeightM': minimum, 'verticesWithin15mm': close,
                           'pelvisProxyPosition': list(rig.pose.bones['root'].head),
                           'elbowPositions': {s: list(rig.pose.bones['lowerarm01.' + s].head) for s in ['L', 'R']}})
        entry['actions'].append({'name': action, 'frames': frames})
        print('CONTACT_AUDIT', faction, action, flush=True)
    out['factions'].append(entry)

(ROOT / 'validation').mkdir(parents=True, exist_ok=True)
(ROOT / 'validation/contacts.json').write_text(json.dumps(out, indent=2) + '\n')
