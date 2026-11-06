const fs=require('fs'),vm=require('vm'),assert=require('assert');const {SS,makeEnv}=require('./gasmock');
const code=fs.readFileSync(process.argv[2],'utf8');const ss=new SS([]);const env=makeEnv(ss);
// --- Drive のモック ---
const id=n=>(n.replace(/\W/g,'_')+'_'.repeat(25)).slice(0,25);
const mkFile=(name,mime,parent,t,size=1000)=>({getId:()=>id(name),getName:()=>name,getMimeType:()=>mime,getDateCreated:()=>new Date(t),getSize:()=>size,
  getParents:()=>it([parent]),getThumbnail:()=>name.includes('nothumb')?null:({getContentType:()=>'image/png',getBytes:()=>[1,2]}),getBlob:()=>({getBytes:()=>[9]})});
function it(arr){let i=0;return {hasNext:()=>i<arr.length,next:()=>arr[i++]};}
const folders={};const mkFolder=(name,subs=[],files=[])=>{const f={getId:()=>id(name),getName:()=>name,getFolders:()=>it(subs),getFiles:()=>it(files.map(x=>x(f)))};folders[id(name)]=f;return f;};
const tops=mkFolder('tops',[],[f=>mkFile('shirt1.jpg','image/jpeg',f,1),f=>mkFile('shirt2.jpg','image/jpeg',f,3),f=>mkFile('memo.pdf','application/pdf',f,2)]);
const pants=mkFolder('pants',[],[f=>mkFile('chino.heic','image/heic',f,1,9e6),f=>mkFile('nothumb.jpg','image/jpeg',f,2)]);
const outside=mkFolder('outside',[],[]); const outsideFile=mkFile('secret.jpg','image/jpeg',outside,1);
const root=mkFolder('rootfolder',[pants,tops],[f=>mkFile('loose.png','image/png',f,5)]);
const allFiles={}; [tops,pants,root].forEach(f=>{const g=f.getFiles();while(g.hasNext()){const x=g.next();allFiles[x.getId()]=x;}}); allFiles[outsideFile.getId()]=outsideFile;
env.DriveApp={getFolderById:i=>{if(!folders[i])throw new Error('nf');return folders[i];},getFileById:i=>{if(!allFiles[i])throw new Error('nf');return allFiles[i];}};
const store={};env.CacheService={getScriptCache:()=>({getAll:k=>Object.fromEntries(k.filter(x=>store[x]).map(x=>[x,store[x]])),put:(k,v)=>{store[k]=v}})};
env.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
let fetchMode='ok';env.ScriptApp={getOAuthToken:()=>'tok'};
env.UrlFetchApp={fetch:(url)=>{ if(fetchMode==='fail') throw new Error('net');
  if(url.includes('fields=thumbnailLink')) return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({thumbnailLink:'https://lh3/abc=s220'})};
  assert(url.endsWith('=s1200')); return {getResponseCode:()=>200,getBlob:()=>({getContentType:()=>'image/jpeg',getBytes:()=>[7,7]})};}};
const ctx=vm.createContext(env);vm.runInContext(code+';this.api={setupSpreadsheet,getInitialData,getColorPatterns,getWardrobeCategories,getWardrobeFiles,getWardrobeThumbnails,getWardrobeImage,normalizeHex_,onEdit};',ctx);const api=ctx.api;
const J=x=>JSON.parse(JSON.stringify(x));
api.setupSpreadsheet();
// ---- 配色パターン ----
let r=J(api.getColorPatterns()); assert.strictEqual(r.patterns.length,10); assert.deepStrictEqual(r.groups,['ネイビー','ブラウン','ワイン','グレー','グリーン','モノトーン']);
assert.deepStrictEqual(r.patterns[2].colors.map(c=>c.ratio),[5,3,2]); assert.strictEqual(r.warnings.length,0);
assert.strictEqual(api.normalizeHex_('1f2a44'),'#1F2A44'); assert.strictEqual(api.normalizeHex_('#abc'),'#AABBCC'); assert.strictEqual(api.normalizeHex_('red'),'');
const P=ss.getSheetByName('ColorPatterns');
P.data.push(['P11','ブラウン','テスト','茶','4a3015','黒','zzz','白','#fff','','','1:1','',true,35]); // 不正 hex・割合の数が合わない
P.data.push(['P12','新グループ','無効','赤','#f00','','','','','','','','',false,1]);
r=J(api.getColorPatterns()); const t=r.patterns.find(p=>p.id==='P11');
assert.deepStrictEqual(t.colors,[{name:'茶',hex:'#4A3015',ratio:1},{name:'白',hex:'#FFFFFF',ratio:1}]); assert.match(r.warnings[0],/zzz/);
assert.deepStrictEqual(r.patterns.map(p=>p.id).slice(2,5),['P03','P11','P04']); assert(!r.groups.includes('新グループ'));
// onEdit は他シートでは何もしない・エラーにならない
api.onEdit({range:ss.getSheetByName('Settings').getRange(2,2)}); api.onEdit(null);
// ---- マイクローゼット ----
assert.throws(()=>api.getWardrobeCategories(),/WARDROBE_FOLDER_ID/);
assert.strictEqual(J(api.getInitialData()).hasWardrobe,false); assert.deepStrictEqual(J(api.getInitialData()).wardrobeLinkItemIds,['F20']);
ss.getSheetByName('Settings').data.find(x=>x[0]==='WARDROBE_FOLDER_ID')[1]='https://drive.google.com/drive/folders/'+id('rootfolder')+'?usp=sharing';
assert.strictEqual(J(api.getInitialData()).hasWardrobe,true);
const cats=J(api.getWardrobeCategories()).categories; assert.deepStrictEqual(cats.map(c=>c.name),['pants','tops','未分類']);
const files=J(api.getWardrobeFiles(id('tops'))).files; assert.deepStrictEqual(files.map(f=>f.name),['shirt2.jpg','shirt1.jpg']);
assert.throws(()=>api.getWardrobeFiles(id('outside')),/表示できません/);
const th=J(api.getWardrobeThumbnails([id('shirt1.jpg'),id('nothumb.jpg'),id('secret.jpg'),'bad']));
assert.strictEqual(th[id('shirt1.jpg')],'data:image/png;base64,AQI='); assert.strictEqual(th[id('nothumb.jpg')],null); assert.strictEqual(th[id('secret.jpg')],null); assert.strictEqual(th.bad,null);
assert(store['thumb_'+id('shirt1.jpg')]);
assert.strictEqual(api.getWardrobeImage(id('shirt1.jpg')),'data:image/jpeg;base64,Bwc=');      // 1. ドライブの縮小画像
fetchMode='fail'; assert.strictEqual(api.getWardrobeImage(id('shirt1.jpg')),'data:image/jpeg;base64,CQ=='); // 2. 元画像
assert.strictEqual(api.getWardrobeImage(id('chino.heic')),'data:image/png;base64,AQI=');      // 3. HEIC・大きい → 縮小画像
assert.throws(()=>api.getWardrobeImage(id('secret.jpg')),/表示できません/);
assert.throws(()=>api.getWardrobeImage('x'),/不正/);
console.log('CLOSET SERVER TESTS PASSED');
