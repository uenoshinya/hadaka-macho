const fs=require('fs'),vm=require('vm'),assert=require('assert');const {SS,makeEnv}=require('./gasmock');
const code=fs.readFileSync(process.argv[2],'utf8');const ss=new SS([]);const env=makeEnv(ss);
const ctx=vm.createContext(env);vm.runInContext(code+';this.api={setupSpreadsheet,saveRecord,getHistory,getRecordDetail};',ctx);const api=ctx.api;
api.setupSpreadsheet();
const J=x=>JSON.parse(JSON.stringify(x));
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.getHistory())),{records:[],total:0});
const st={C01:'ok',C04:'concern'};
const prod=n=>({name:'商品'+n,brand:'B',category:'シャツ',conditionType:'古着',price:String(1000*n),memo:'メモ'+n,judgment:'見送り'});
for(let i=1;i<=5;i++) api.saveRecord({recordId:'CC-20261106-0000000'+i,product:prod(i),statuses:st,excluded:[]});
let h=J(api.getHistory()); assert.strictEqual(h.total,5); assert.deepStrictEqual(h.records.map(r=>r.productName),['商品5','商品4','商品3','商品2','商品1']);
assert.strictEqual(h.records[0].price,5000); assert(!('memo' in h.records[0]));
// HISTORY_LIMIT
ss.getSheetByName('Settings').data.find(r=>r[0]==='HISTORY_LIMIT')[1]=2; h=J(api.getHistory()); assert.strictEqual(h.records.length,2); assert.strictEqual(h.total,5);
// 詳細
let d=J(api.getRecordDetail('CC-20261106-00000003')); assert.strictEqual(d.productName,'商品3'); assert.strictEqual(d.memo,'メモ3');
assert.strictEqual(d.autoJudgment,'見送り'); assert.strictEqual(d.items.length,20); assert.strictEqual(d.items.find(x=>x.id==='C04').status,'concern'); assert.strictEqual(d.jsonError,false);
assert.throws(()=>api.getRecordDetail('CC-x'),/見つかりませんでした/); assert.throws(()=>api.getRecordDetail(''),/不正/);
// JSON が壊れていても基本情報は返す
const H=ss.getSheetByName('PurchaseHistory'); H.data[1][11]='{壊れた'; d=J(api.getRecordDetail('CC-20261106-00000001'));
assert.strictEqual(d.jsonError,true); assert.strictEqual(d.productName,'商品1'); assert.strictEqual(d.items.length,0);
// 空行は無視
H.data[6]=['','','','','','','','','','','','']; H.data[7]=['CC-manual','2026/01/01','手入力','','','','','','','','',''];
h=J(api.getHistory()); assert.strictEqual(h.records[0].productName,'手入力'); assert.strictEqual(h.records[0].price,null);
console.log('HISTORY SERVER TESTS PASSED');
