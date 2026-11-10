import{readFile,writeFile,mkdir,copyFile,rm,cp}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';import{build}from'esbuild';
const root=resolve('assets-3d/crawl-rework'),out=resolve(process.env.AW_CRAWL_DIST||'/workspace/crawl-review-dist');await rm(resolve(out,'models'),{recursive:true,force:true});await mkdir(resolve(out,'models'),{recursive:true});
const source=JSON.parse(await readFile('animation-preview-pages/dist/tactical-source.json','utf8'));
const manifest={revision:'reference-crawl-1',repositoryBranch:'feat/reference-tactical-motion-rework',repositoryCommit:process.env.AW_COMMIT||null,baselineCommit:source.commit,duration:2.4,speedMps:.23,changedClips:['TC_CrawlForward_Lower','TC_CrawlForward_Upper'],factions:{}};
for(const f of ['USMC','Russian']){const path=resolve(root,'models',f+'_CrawlForward.animation.glb');const data=await readFile(path),sha=createHash('sha256').update(data).digest('hex'),name=f+'_CrawlForward.'+sha.slice(0,12)+'.glb';await copyFile(path,resolve(out,'models',name));manifest.factions[f]={baseModel:'/'+source.models[f].model,baseSha256:source.models[f].sha256,animation:'models/'+name,animationSha256:sha};}
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const f of ['index.html','style.css'])await copyFile(resolve(root,'preview',f),resolve(out,f));
await build({entryPoints:[resolve(root,'preview/app.js')],outfile:resolve(out,'app.js'),bundle:true,format:'esm',target:['safari15.4','chrome100'],minify:true});console.log(out);
await mkdir(resolve(out,'recordings'),{recursive:true});
for(const f of ['USMC','Russian'])for(const view of ['side','iso']){try{await copyFile(resolve(root,'review',`${f}-${view}.mp4`),resolve(out,'recordings',`${f}-${view}.mp4`));}catch(e){if(e.code!=='ENOENT')throw e;}}
await cp(resolve(root,'review/reference'),resolve(out,'reference'),{recursive:true});await copyFile(resolve(root,'review/reference-study.html'),resolve(out,'reference-study.html'));
