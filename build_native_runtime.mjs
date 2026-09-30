/* Native-only transport assets, built from the same npm SDK and cue source. */
import {build} from 'esbuild';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {cues,envelope}=require('./assets/app/mode-atlas-sound-cues.js');
const [destination,revision]=process.argv.slice(2);
if(!destination||!/^assets-\d+\.\d+\.\d+$/.test(revision||''))throw new Error('Output and release revision are required.');
const output=resolve(destination),temporary=await mkdtemp(join(tmpdir(),'mode-atlas-sdk-'));
try{
  // Splitting preserves one Firebase component registry across all entry points.
  const exports={
    app:'initializeApp,getApps,getApp',
    auth:'getAuth,initializeAuth,browserLocalPersistence,GoogleAuthProvider,OAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,signInWithCredential,linkWithCredential,reauthenticateWithPopup,reauthenticateWithCredential,signOut,onAuthStateChanged',
    firestore:'getFirestore,doc,getDoc,setDoc',
    functions:'getFunctions,httpsCallable'
  };
  const entries={};
  for(const [name,api]of Object.entries(exports)){
    entries['firebase-'+name]=join(temporary,name+'.js');
    await writeFile(entries['firebase-'+name],`export {${api}} from 'firebase/${name}';`);
  }
  await build({entryPoints:entries,outdir:join(output,'assets/vendor'),bundle:true,splitting:true,format:'esm',platform:'browser',target:'safari18',minify:true,legalComments:'eof',nodePaths:[resolve('node_modules')],entryNames:`[name].${revision}`,chunkNames:`firebase-chunk-[hash].${revision}`});
  const audio=join(output,'assets/audio');await mkdir(audio,{recursive:true});
  const rate=44100;
  for(const [name,notes]of Object.entries(cues)){
    const count=Math.ceil((Math.max(...notes.map(note=>note[1]+note[4]))+.015)*rate),samples=new Float64Array(count);
    for(const [frequency,duration,type,level,delay,slide]of notes){
      let phase=0;const length=Math.ceil(duration*rate),start=Math.round(delay*rate);
      for(let i=0;i<length;i++){
        const time=i/rate,freq=slide?frequency*(slide/frequency)**(time/duration):frequency;
        samples[start+i]+=Math.sin(phase)*level*envelope(time,duration);
        phase+=2*Math.PI*freq/rate;
      }
    }
    const wav=Buffer.alloc(44+count*2);
    wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);
    wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40);
    samples.forEach((value,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+i*2));
    await writeFile(join(audio,name+'.wav'),wav);
  }
}finally{await rm(temporary,{recursive:true,force:true});}
