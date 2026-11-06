const fs=require('fs'),vm=require('vm'),assert=require('assert');const {SS,makeEnv}=require('./gasmock');
const code=fs.readFileSync(process.argv[2],'utf8');const ss=new SS([]);const env=makeEnv(ss);
const ctx=vm.createContext(env);vm.runInContext(code+';this.api={setupSpreadsheet,saveRecord,CONFIG};',ctx);const api=ctx.api;
api.setupSpreadsheet();
const H=ss.getSheetByName('PurchaseHistory'); const hdr=api.CONFIG.SHEETS.HISTORY.headers; const col=n=>hdr.indexOf(n);
const V=Array.from({length:20},(_,i)=>'C'+String(i+1).padStart(2,'0'));
const allOk=Object.fromEntries(V.map(i=>[i,'ok']));
const product={name:'ツイードジャケット',brand:'Harris Tweed',category:'ジャケット',conditionType:'古着',price:'8,800',memo:'袖口に\r\n少しスレ',judgment:'買い'};
const base={recordId:'CC-20261106-abcd1234',product,statuses:{...allOk,C07:'concern'},excluded:[]};
// 正常保存：ユーザーの判定(買い)と自動判定(要検討)を別々に記録
let r=api.saveRecord(base); assert.strictEqual(r.duplicated,false); assert.strictEqual(r.autoJudgment,'要検討'); assert.strictEqual(r.judgment,'買い');
assert.strictEqual(H.getLastRow(),2); const row=H.data[1];
assert.strictEqual(row[col('price')],8800); assert.strictEqual(row[col('condition_result')],'要検討'); assert.strictEqual(row[col('fitting_result')],'未実施');
assert.strictEqual(row[col('judgment')],'買い'); assert.strictEqual(row[col('memo')],'袖口に\n少しスレ'); assert.strictEqual(Object.prototype.toString.call(row[col('created_at')]),'[object Date]');
const j=JSON.parse(row[col('checked_items_json')]); assert.strictEqual(j.version,1); assert.strictEqual(j.auto_judgment,'要検討');
assert.strictEqual(j.items.length,20); assert.strictEqual(j.items.find(x=>x.id==='C07').status,'concern'); assert.strictEqual(j.progress.vintage,1);
// 同じ record_id → 二重保存しない
r=api.saveRecord(base); assert.strictEqual(r.duplicated,true); assert.strictEqual(H.getLastRow(),2);
// 数式インジェクション対策
api.saveRecord({...base,recordId:'CC-20261106-0000beef',product:{...product,name:'=HYPERLINK("x")',memo:'@mention',brand:'-'}});
assert.strictEqual(H.data[2][col('product_name')],"'=HYPERLINK(\"x\")"); assert.strictEqual(H.data[2][col('memo')],"'@mention");
// 対象外カテゴリー・試着の記録
const F=V.map(x=>x.replace('C','F'));
api.saveRecord({...base,recordId:'CC-20261106-00000003',statuses:Object.fromEntries(F.map(i=>[i,'ok'])),excluded:['fitting|C. パンツのサイズ感']});
const j3=JSON.parse(H.data[3][col('checked_items_json')]); assert.deepStrictEqual(j3.excluded_categories,['C. パンツのサイズ感']);
assert.strictEqual(j3.items.filter(x=>x.status==='excluded').length,5); assert.strictEqual(H.data[3][col('fitting_result')],'買い');
// 検証エラー（すべての問題をまとめて返す）
assert.throws(()=>api.saveRecord({...base,recordId:'CC-20261106-00000004',product:{name:' ',brand:'x'.repeat(51),category:'帽子',conditionType:'中古',price:'abc',memo:'m'.repeat(1001),judgment:'様子見'}}),
  e=>{['商品名を入力','ブランドは 50','カテゴリーを選','古着か新品','価格は','メモは 1000','総合判定を選'].forEach(t=>assert(e.message.includes(t),t));return true;});
assert.throws(()=>api.saveRecord({...base,recordId:'CC-20261106-00000005',product:{...product,price:'-100'}}),/価格は/);
assert.throws(()=>api.saveRecord({...base,recordId:'CC-20261106-00000006',product:{...product,price:'10000001'}}),/価格は/);
api.saveRecord({...base,recordId:'CC-20261106-00000007',product:{...product,price:'0',brand:''}});
assert.throws(()=>api.saveRecord({...base,recordId:'bad'}),/記録 ID が不正/);
assert.throws(()=>api.saveRecord({...base,recordId:'CC-20261106-00000008',statuses:{}}),/チェックした項目がありません/);
assert.throws(()=>api.saveRecord(null),/受け取れません/);
// ロックが取れない
env.LockService.getScriptLock=()=>({tryLock:()=>false,releaseLock(){}}); assert.throws(()=>api.saveRecord({...base,recordId:'CC-20261106-00000009'}),/混み合って/);
assert.strictEqual(H.getLastRow(),5);
console.log('SAVE TESTS PASSED');
