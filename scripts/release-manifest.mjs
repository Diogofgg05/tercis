import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';

// No environment files, local tooling, credentials, logs or user data enter
// this inventory. The manifest identifies the actual source, including edits
// that have not yet been committed, rather than mislabelling it with HEAD.
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0')
  .filter(file=>/^(src\/|public\/catalog\/|data\/|scripts\/|tests\/|supabase\/|\.github\/|(?:package(?:-lock)?\.json|index\.html|vite\.config\.ts|tsconfig[^/]*\.json|tailwind\.config\.js|postcss\.config\.js|eslint\.config\.js)$)/.test(file))
  .filter(file=>!/(^|\/)(node_modules|\.temp|\.env[^/]*)(\/|$)|\.local(?:\/|$)|\.pyc$/.test(file)).sort();
const fingerprint=createHash('sha256');
for(const file of files){fingerprint.update(file+'\0');fingerprint.update(sha(await readFile(file))+'\n');}
const migrations=[];
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
  migrations.push({file,sha256:sha(await readFile('supabase/migrations/'+file))});
}
const remoteArg=process.argv.indexOf('--remote-migrations');
let database={status:'not-verified',matched:0,localOnly:[],remoteOnly:[]};
if(remoteArg!==-1){
  const remote=JSON.parse(await readFile(process.argv[remoteArg+1],'utf8'));
  const names=(Array.isArray(remote)?remote:remote.migrations).map(r=>r.name);
  const matched=new Set();
  const localOnly=migrations.filter(({file})=>{
    const stem=file.replace(/\.sql$/,'');const name=stem.replace(/^\d+_/,'');
    const match=names.find(n=>[stem,'tercis_'+stem,name,'tercis_'+name].includes(n));
    if(match)matched.add(match);return !match;
  }).map(m=>m.file);
  const remoteOnly=names.filter(n=>!matched.has(n));
  database={status:localOnly.length||remoteOnly.length?'diverged':'names-aligned',matched:matched.size,localOnly,remoteOnly};
  // Matching names prove deployment inventory, not equivalence of live DDL.
  if(database.status==='diverged')process.exitCode=1;
}
const pkg=JSON.parse(await readFile('package.json','utf8'));
const manifest={version:pkg.version,generatedAt:new Date().toISOString(),branch:git('branch','--show-current'),baseCommit:git('rev-parse','HEAD'),uncommitted:Boolean(git('status','--porcelain')),sourceSha256:fingerprint.digest('hex'),migrationCount:migrations.length,migrations,database};
await writeFile('public/release.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:manifest.version,sourceSha256:manifest.sourceSha256,migrations:migrations.length,database}));
