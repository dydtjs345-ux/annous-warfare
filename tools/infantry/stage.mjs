import {copyFile,writeFile,readdir,unlink} from 'node:fs/promises';
await copyFile('dist-infantry/infantry-test.html','dist-infantry/index.html');
await writeFile('dist-infantry/build-info.json',JSON.stringify({branch:'integration/complete-infantry-visual-system',sourceCommit:process.env.AW_COMMIT||'local',simulationBase:'b381e6017d01fa34f14e889ff639347db9e5feae',modelSource:'66d3892',build:'infantry-6v6-test',sprint:'candidate awaiting visual approval'},null,2));

for(const file of await readdir('dist-infantry/assets/infantry-test'))if(file.endsWith('.png'))await unlink('dist-infantry/assets/infantry-test/'+file);

await import('./stage-inspection.mjs');
