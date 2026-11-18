/* Pure recognition adapters. These NEVER save inventory or infer skein quantities.
 * OCR labels can be wrong. Only known DMC identifiers become review candidates.
 * Barcode values must be matched with curated records or explicitly confirmed by the user.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSmartStashRecognition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function codeFromLabel(raw,chart){const str=String(raw||'').replace(/[\u200b-\u200d]/g,'').trim().toUpperCase();
 if(/\b(?:ANCHOR|SULLIVANS|COSMO)\b/.test(str))return null;
 const pref=/\bDMC\s*[-#:]*\s*(B5200|WHITE|BLANC|ECRU|\d{1,4})\b/.exec(str);
 const simple=/^\s*(B5200|WHITE|BLANC|ECRU|\d{1,4})\s*$/.exec(str);
 const candidate=pref?.[1]||simple?.[1];if(!candidate||!Object.prototype.hasOwnProperty.call(chart,candidate))return null;
 return {code:candidate,confidence:pref?'labeled':'unlabeled'};
}
function extractOCR(blocks,chart){if(!Array.isArray(blocks))throw Error('OCR results must be a list.');const seen=new Map(),ignored=[];
 for(const block of blocks.slice(0,1500)){
  const raw=String(typeof block==='string'?block:(block?.rawValue??block?.text??'')).trim();
  for(const line of raw.split(/[\r\n]+/)){
   const c=codeFromLabel(line,chart);if(!c){if(line.trim())ignored.push(line.slice(0,70));continue}
   const old=seen.get(c.code);if(old){old.appearances++;if(c.confidence==='labeled')old.confidence='labeled'}
   else seen.set(c.code,{code:c.code,qty:null,verified:false,confidence:c.confidence,appearances:1,line:'Photo'});
  }
 }
 return{records:[...seen.values()],issues:[],ignored:ignored.slice(0,100),scanned:blocks.length};
}
function validEAN(s){if(!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(String(s||'')))return false;
 const t=String(s),check=Number(t.at(-1)),d=t.slice(0,-1).split('').reverse().reduce((sum,n,i)=>sum+Number(n)*(i%2===0?3:1),0);
 return (10-d%10)%10===check;
}
function lookupBarcode(barcode,registry={},chart={}){const s=String(barcode||'').trim();if(!validEAN(s))return {ok:false,reason:'unrecognized-or-invalid-barcode'};
 const record=registry[s]||(s.length===13&&s[0]==='0'?registry[s.slice(1)]:null)||(s.length===12?registry['0'+s]:null);
 if(!record)return {ok:false,reason:'no-verified-mapping'};
 const brand=String(record.brand||'').toUpperCase(),code=String(record.code||'').toUpperCase();
 if(brand!=='DMC'||!Object.prototype.hasOwnProperty.call(chart,code))return {ok:false,reason:'unsupported-or-unverified-color'};
 return {ok:true,code,brand:'DMC'};
}
return{codeFromLabel,extractOCR,validEAN,lookupBarcode};
});
