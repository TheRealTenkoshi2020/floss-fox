/* Best-effort guard for accidentally pasted private identifiers. This is NOT
 * a comprehensive PII detector. It never transmits or stores the checked text. */
(function(root){
 'use strict';
 const patterns=[
  {id:'email',label:'email address',re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i},
  {id:'phone',label:'telephone number',re:/(?:^|\D)(?:\+?1[.\s-]?)?\(?\d{3}\)?[.\s-]?\d{3}[.\s-]?\d{4}(?!\d)/},
  {id:'ssn',label:'US Social Security number',re:/\b\d{3}-\d{2}-\d{4}\b/},
  {id:'secret',label:'credential-like text',re:/(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*\S{6,}/i},
  {id:'street',label:'possible street address',re:/\b\d{1,6}\s+(?:[A-Za-z]+\s+){0,3}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln)\b/i}
 ];
 function scan(text){const s=String(text||'');return patterns.filter(p=>p.re.test(s)).map(p=>p.label)}
 const api=Object.freeze({scan});root.FlossFoxPipPrivacy=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
