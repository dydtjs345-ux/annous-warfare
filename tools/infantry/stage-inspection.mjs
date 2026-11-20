import {mkdir,copyFile,readdir,writeFile} from 'node:fs/promises';
const dest='dist-infantry/inspection';await mkdir(dest,{recursive:true});
for(const [folder,names] of Object.entries({
 'tactical-combat/models':['USMC_Tactical.glb','Russian_Tactical.glb'],
 'crawl-torso/models':['USMC_CrawlForward.animation.glb','Russian_CrawlForward.animation.glb'],
 'phase2-crouch/models':['TacticalSuit_Phase2.glb'],
 'cover-combat-integration/models':['TacticalSuit_Cover.glb','M16A4_Cover.animation.glb','AK74M_Cover.animation.glb']
}))for(const name of names)await copyFile('assets-3d/'+folder+'/'+name,dest+'/'+name);
await mkdir(dest+'/licenses',{recursive:true});for(const name of await readdir('assets-3d/cover-combat-integration/licenses'))await copyFile('assets-3d/cover-combat-integration/licenses/'+name,dest+'/licenses/'+name);
await copyFile('reports/complete-infantry/INVENTORY.md','dist-infantry/animation-inventory.md');
