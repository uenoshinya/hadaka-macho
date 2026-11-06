const fs=require('fs'),vm=require('vm'),assert=require('assert');const {SS,makeEnv}=require('./gasmock');
const code=fs.readFileSync(process.argv[2],'utf8');const ss=new SS([]);const env=makeEnv(ss);
const ctx=vm.createContext(env);vm.runInContext(code+';this.api={setupSpreadsheet,evaluateCheck};',ctx);const api=ctx.api;
api.setupSpreadsheet();
const V=Array.from({length:20},(_,i)=>'C'+String(i+1).padStart(2,'0')), F=V.map(x=>x.replace('C','F'));
const crit=['C01','C02','C04','C11','C14','C16'], warn=['C05','C06','C07','C09','C13','C15','C17','C18'];
const allOk=ids=>Object.fromEntries(ids.map(i=>[i,'ok']));
const ev=(st,ex=[])=>JSON.parse(JSON.stringify(api.evaluateCheck({statuses:st,excluded:ex})));
let r;
// 何もなし
r=ev({}); assert.strictEqual(r.overall,'未実施'); assert.strictEqual(r.modes.vintage.result,'未実施');
// 全部OK → 買い、試着は未実施
r=ev(allOk(V)); assert.strictEqual(r.overall,'買い'); assert.strictEqual(r.modes.fitting.result,'未実施'); assert.strictEqual(r.reasons.length,0);
// critical 1つ → 他が全部OKでも見送り
r=ev({...allOk(V),C04:'concern'}); assert.strictEqual(r.overall,'見送り'); assert.match(r.reasons[0].text,/重大：虫食い/);
// warning 1 → 要検討, 3 → 見送り
r=ev({...allOk(V),C07:'concern'}); assert.strictEqual(r.overall,'要検討');
r=ev({...allOk(V),C05:'concern',C06:'concern',C07:'concern'}); assert.strictEqual(r.overall,'見送り');
// normal 2 → 買い（軽微の理由は表示）, 3 → 要検討
r=ev({...allOk(V),C03:'concern',C08:'concern'}); assert.strictEqual(r.overall,'買い'); assert.strictEqual(r.reasons.filter(x=>x.level==='normal').length,2);
r=ev({...allOk(V),C03:'concern',C08:'concern',C10:'concern'}); assert.strictEqual(r.overall,'要検討');
// critical 未確認 → 要検討（進捗95%でも）
const st=allOk(V); delete st.C16; r=ev(st); assert.strictEqual(r.overall,'要検討'); assert.match(r.reasons[0].text,/未確認.*カビ臭/);
// 進捗不足（critical は全部確認、他少し）→ 要検討
r=ev(allOk([...crit,'C03'])); assert.strictEqual(r.overall,'要検討'); assert.match(r.reasons.map(x=>x.text).join(),/35%/);
// 進捗ちょうど80% → 買い
r=ev(allOk([...crit,...warn,'C03','C08'])); assert.strictEqual(r.modes.vintage.done,16); assert.strictEqual(r.overall,'買い');
// 総合判定は悪い方：古着買い＋試着見送り
r=ev({...allOk(V),...allOk(F),F17:'concern'}); assert.strictEqual(r.modes.vintage.result,'買い'); assert.strictEqual(r.modes.fitting.result,'見送り'); assert.strictEqual(r.overall,'見送り');
// 対象外：パンツを除外すると15項目で判定。除外カテゴリーの critical 気になるは無視
const fNoPants=F.filter(x=>!['F11','F12','F13','F14','F15'].includes(x));
r=ev({...allOk(fNoPants),F11:'concern'},['fitting|C. パンツのサイズ感']); assert.strictEqual(r.modes.fitting.total,15); assert.strictEqual(r.overall,'買い');
// 不正な入力は捨てる
r=ev({C01:'concern<script>',C02:'bad',ZZZ:'concern'}); assert.strictEqual(r.overall,'未実施');
assert.throws(()=>api.evaluateCheck(null),/受け取れません/);
// 理由は重い順
r=ev({...allOk(V),C03:'concern',C07:'concern',C04:'concern'}); assert.deepStrictEqual(r.reasons.map(x=>x.level),['critical','warning','normal']);
// しきい値は Settings で変更できる
ss.getSheetByName('Settings').data.find(x=>x[0]==='WARNING_SKIP_THRESHOLD')[1]=1;
r=ev({...allOk(V),C07:'concern'}); assert.strictEqual(r.overall,'見送り');
console.log('JUDGE TESTS PASSED');
