/* Floss Fox project allocations: independent, non-destructive sidecar.
 * Browser: window.FlossFoxAllocations; Node: require('./allocations.js').
 * NEVER mutates the projects collection or records consumption automatically.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAllocations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 1, MAX = 999, MAX_RECORDS = 20000;
  const empty = () => ({schema: SCHEMA, allocations: []});
  const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj || {}, k);
  const safeId = id => typeof id === 'string' && id.length > 0 && id.length <= 80;
  const validCode = (code, knownCodes) => typeof code === 'string' && code.length > 0 && code.length <= 32 && (!knownCodes || own(knownCodes, code));
  const validQty = n => Number.isInteger(n) && n >= 0 && n <= MAX;
  const key = (projectId, code) => JSON.stringify([projectId, code]);
  const clone = x => JSON.parse(JSON.stringify(x));

  // Fail closed: invalid / newer schema is never overwritten or partially imported.
  function validate(input, knownCodes) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.allocations))
      return {ok:false, reason:'invalid-shape'};
    if (!Number.isInteger(input.schema) || input.schema > SCHEMA)
      return {ok:false, reason: input.schema > SCHEMA ? 'future-schema' : 'invalid-schema'};
    if (input.schema !== SCHEMA || input.allocations.length > MAX_RECORDS)
      return {ok:false, reason:'invalid-schema-or-size'};
    const seen = new Set(), rows = [];
    for (const row of input.allocations) {
      if (!row || typeof row !== 'object' || !safeId(row.projectId) ||
          !validCode(row.code, knownCodes) || !validQty(row.qty) || row.qty === 0)
        return {ok:false, reason:'invalid-row'};
      const k = key(row.projectId, row.code);
      if (seen.has(k)) return {ok:false, reason:'duplicate-row'};
      seen.add(k);
      rows.push({projectId:row.projectId, code:row.code, qty:row.qty});
    }
    rows.sort((a,b) => a.projectId.localeCompare(b.projectId) || a.code.localeCompare(b.code));
    return {ok:true, data:{schema:SCHEMA, allocations:rows}};
  }
  const quantity = (collection, code) => {
    const entry = collection && collection.threads && collection.threads[code];
    // Unknown amount is NOT proof of zero. Called as null to gate allocation edits.
    return entry && Number.isInteger(entry.n) && entry.n >= 0 ? entry.n : null;
  };
  function summary(data, collection, code, projectId) {
    const owned = quantity(collection, code), rows = data.allocations.filter(r => r.code === code);
    const reserved = rows.reduce((n,r) => n + r.qty,0);
    const ownReserved = projectId ? rows.filter(r=>r.projectId===projectId).reduce((n,r)=>n+r.qty,0) : 0;
    const othersReserved = reserved - ownReserved;
    return {code, owned, reserved, ownReserved, othersReserved,
      unallocated: owned===null?null:Math.max(0,owned-reserved),
      availableForProject: owned===null?null:Math.max(0,owned-othersReserved),
      overallocated: owned!==null && reserved>owned,
      shortage: owned===null?null:Math.max(0,reserved-owned),
      unknownStock:owned===null};
  }
  function set(data, {projectId, code, qty}, {projects, knownCodes, collection} = {}) {
    if (!safeId(projectId) || !validCode(code,knownCodes) || !validQty(qty)) return {ok:false,reason:'invalid-request'};
    if (!Array.isArray(projects) || !projects.some(p=>p && p.id===projectId && p.demo!==true))
      return {ok:false,reason:'missing-or-demo-project'};
    const checked = validate(data,knownCodes);
    if (!checked.ok) return checked;
    const next = clone(checked.data);
    next.allocations = next.allocations.filter(r=>r.projectId!==projectId || r.code!==code);
    if(qty>0)next.allocations.push({projectId,code,qty});
    if(next.allocations.length>MAX_RECORDS)return {ok:false,reason:'too-many-allocations'};
    const owned = quantity(collection,code);
    // Users can lower/cancel a conflicting reservation even if stock has since changed.
    const prev = summary(checked.data,collection,code);
    const after = summary(next,collection,code);
    if(qty>0 && owned===null)return {ok:false,reason:'unknown-stock'};
    if(after.overallocated && (after.reserved>prev.reserved || !prev.overallocated))
      return {ok:false,reason:'insufficient-unallocated-stock',details:after};
    const result=validate(next,knownCodes);
    return result.ok?{ok:true,data:result.data,details:after}:result;
  }
  function audit(data, collection, projects) {
    const validIds = new Set((projects||[]).filter(p=>p&&p.demo!==true).map(p=>p.id));
    const orphaned = data.allocations.filter(r=>!validIds.has(r.projectId));
    const codes=[...new Set(data.allocations.map(r=>r.code))];
    const conflicts=codes.map(code=>summary(data,collection,code)).filter(s=>s.overallocated||s.unknownStock);
    return {orphaned,conflicts,ok:orphaned.length===0&&conflicts.length===0};
  }
  // Combined shopping: inventory is deducted ONCE, and reservations belonging to
  // selected projects remain usable by those projects; outside reservations are protected.
  // `demands` must be validated, confirmed skein requirements for selected projects.
  // Missing/assumed/estimated-but-unreviewed quantities go to checkFirst, never totals.
  function multiProjectAvailability(data, collection, selectedProjectIds, demands) {
    const selected=new Set(selectedProjectIds||[]), groups=new Map(), checkFirst=[];
    for (const d of demands||[]) {
      if(!selected.has(d.projectId))continue;
      if(!validCode(d.code) || !Number.isInteger(d.qty) || d.qty<0 ||
         d.verified!==true || d.isDmc!==true || d.qty>100000) {
        checkFirst.push({projectId:d.projectId,code:d.code,reason:'unverified-or-unsupported-demand'});continue;
      }
      groups.set(d.code,(groups.get(d.code)||0)+d.qty);
    }
    const lines=[];
    for(const [code,required] of groups){
      const stock=quantity(collection,code);
      const outsideReserved=data.allocations.filter(r=>r.code===code&&!selected.has(r.projectId)).reduce((n,r)=>n+r.qty,0);
      const allReserved=data.allocations.filter(r=>r.code===code).reduce((n,r)=>n+r.qty,0);
      if(stock===null || allReserved>stock){
        checkFirst.push({code,reason:stock===null?'unknown-stock':'allocation-conflict'});continue;
      }
      const available=Math.max(0,stock-outsideReserved);
      lines.push({code,required,available,outsideReserved,buy:Math.max(0,required-available)});
    }
    lines.sort((a,b)=>a.code.localeCompare(b.code));
    return {lines,checkFirst,complete:checkFirst.length===0,
      // Do not present a final number while ANY check-first item remains.
      buyTotal:checkFirst.length===0?lines.reduce((n,l)=>n+l.buy,0):null};
  }
  // Browser sidecar uses separate production/preview keys; storage failures are explicit.
  function storage(storageObject, keyName, knownCodes) {
    const KEY=keyName || 'flossfox.allocations.v1';
    let current=empty(), writable=true, issue=null;
    try {
      const raw=storageObject.getItem(KEY);
      if(raw!==null){const v=validate(JSON.parse(raw),knownCodes);
        if(!v.ok){writable=false;issue=v.reason;} else current=v.data;}
    } catch(err){writable=false;issue='unreadable-or-blocked';}
    return {
      KEY, read:()=>clone(current), writable:()=>writable, issue:()=>issue,
      update:(request,context)=>{
        if(!writable)return {ok:false,reason:'saving-paused:'+issue};
        const next=set(current,request,{...context,knownCodes});
        if(!next.ok)return next;
        try{storageObject.setItem(KEY,JSON.stringify(next.data));}
        catch(err){return {ok:false,reason:'storage-write-failed'};}
        current=next.data;return next;
      },
      // For restore: caller must snapshot & validate the FULL backup first.
      replace:(input)=>{
        if(!writable)return {ok:false,reason:'saving-paused:'+issue};
        const v=validate(input,knownCodes);if(!v.ok)return v;
        try{storageObject.setItem(KEY,JSON.stringify(v.data));}
        catch(err){return {ok:false,reason:'storage-write-failed'};}
        current=v.data;return {ok:true};
      }
    };
  }
  return {SCHEMA,empty,validate,summary,set,audit,multiProjectAvailability,storage};
});
