import {spawn} from 'node:child_process';
// Accept the preview daemon's Vite-style flags while running the actual Next dev server.
const args=process.argv.slice(2).filter(a=>a!=='--strictPort').map(a=>a==='--host'?'--hostname':a);
if(!args.includes('--hostname'))args.push('--hostname','0.0.0.0');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',e=>{console.error(e.message);process.exit(1)});
child.on('exit',code=>process.exit(code??1));
