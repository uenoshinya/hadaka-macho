const fs=require('fs'), vm=require('vm'), assert=require('assert');
const eq=(a,b)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b));
const {SS,makeEnv}=require('./gasmock');
const code=fs.readFileSync(process.argv[2],'utf8');
function load(ss){ const env=makeEnv(ss); const ctx=vm.createContext(env); vm.runInContext(code+'\n;this.__api={setupSpreadsheet,ensureSheets_,CONFIG,DEFAULT_CHECKLIST};',ctx); return {env,api:ctx.__api}; }

// 1. 新規スプレッドシート
let ss=new SS(['シート1']); let {env,api}=load(ss);
let msg=api.setupSpreadsheet(); console.log(msg);
eq(ss.sheets.map(s=>s.name),['Checklist','PurchaseHistory','Settings','ColorPatterns']);
const cl=ss.getSheetByName('Checklist');
assert.strictEqual(cl.getLastRow(),41); assert.strictEqual(cl.frozen,1);
eq(cl.data[0],api.CONFIG.SHEETS.CHECKLIST.headers);
assert.strictEqual(ss.getSheetByName('PurchaseHistory').getLastRow(),1);
assert.strictEqual(ss.getSheetByName('Settings').getLastRow(),11);
// ID の一意性
const ids=api.DEFAULT_CHECKLIST.map(r=>r[0]); assert.strictEqual(new Set(ids).size,ids.length);
api.DEFAULT_CHECKLIST.forEach(r=>{assert(api.CONFIG.TARGET_TYPES.includes(r[3]));assert(api.CONFIG.SEVERITIES.includes(r[4]));});

// 2. 再実行しても壊れない＆ユーザー編集を保持
cl.data[1][2]='（編集済み）'; ss.getSheetByName('Settings').data[3][1]=5;
ss.getSheetByName('Settings').data.splice(7,1); // HISTORY_LIMIT を削除
msg=api.setupSpreadsheet(); console.log('\n'+msg);
assert.strictEqual(cl.getLastRow(),41); assert.strictEqual(cl.data[1][2],'（編集済み）');
assert.strictEqual(ss.getSheetByName('Settings').data[3][1],5);
assert.strictEqual(ss.getSheetByName('Settings').getLastRow(),11);

// 3. シートを消しても自動復旧
ss.deleteSheet(ss.getSheetByName('PurchaseHistory'));
eq(api.ensureSheets_(),['PurchaseHistory']);

// 4. ヘッダー不一致はエラー
ss.getSheetByName('Checklist').data[0][1]='カテゴリ';
assert.throws(()=>api.ensureSheets_(),/見出し/);

// 5. データ入りの「シート1」は消さない
ss=new SS(['シート1']); ss.sheets[0].data=[['memo']]; ({api}=load(ss)); api.setupSpreadsheet();
assert(ss.getSheetByName('シート1'));
console.log('\nALL STEP2 TESTS PASSED');
