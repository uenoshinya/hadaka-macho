// 最小限の SpreadsheetApp / LockService / Logger モック
function chain(){ const p = new Proxy(function(){}, {get:(t,k)=> k==='then'?undefined:(()=>p), apply:()=>p}); return p; }
class Sheet {
  constructor(name){ this.name=name; this.data=[]; this.frozen=0; }
  getName(){return this.name}
  getLastRow(){ for(let r=this.data.length;r>0;r--) if(this.data[r-1]&&this.data[r-1].some(v=>v!==''&&v!=null)) return r; return 0; }
  getLastColumn(){ let m=0; this.data.forEach(row=>row.forEach((v,i)=>{ if(v!==''&&v!=null) m=Math.max(m,i+1)})); return m; }
  getRange(r,c,nr=1,nc=1){ const s=this; let px; const rng={
    getValues(){ const out=[]; for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const rr=s.data[r-1+i]; row.push(rr&&rr[c-1+j]!==undefined?rr[c-1+j]:'');} out.push(row);} return out; },
    setValues(v){ if(v.length!==nr||v[0].length!==nc) throw new Error(`size mismatch ${v.length}x${v[0].length} vs ${nr}x${nc}`); v.forEach((row,i)=>{ const rr=s.data[r-1+i]||(s.data[r-1+i]=[]); row.forEach((x,j)=>rr[c-1+j]=x);}); return px; },
  }; px=new Proxy(rng,{get:(t,k)=>k in t?t[k]:(()=>px)}); return px; }
  setFrozenRows(n){this.frozen=n} setColumnWidth(){}
}
class SS {
  constructor(names){ this.sheets=names.map(n=>new Sheet(n)); }
  getSheetByName(n){ return this.sheets.find(s=>s.name===n)||null; }
  insertSheet(n){ const s=new Sheet(n); this.sheets.push(s); return s; }
  getSheets(){ return this.sheets.slice(); }
  deleteSheet(s){ this.sheets=this.sheets.filter(x=>x!==s); }
}
function makeEnv(ss){
  const logs=[];
  return { ss, logs,
    SpreadsheetApp:{ getActiveSpreadsheet:()=>ss, openById:()=>ss, getUi:()=>{throw new Error('no ui')},
      flush:()=>{}, newDataValidation:()=>chain(), WrapStrategy:{CLIP:'CLIP'} },
    LockService:{ getScriptLock:()=>({waitLock(){}, tryLock(){return true}, releaseLock(){}}) },
    Logger:{ log:(m)=>logs.push(m) },
    Utilities:{ formatDate:(d)=>d.toISOString() },
  };
}
module.exports = { SS, makeEnv };
