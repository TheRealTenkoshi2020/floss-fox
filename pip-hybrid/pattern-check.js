/* Pattern check (dev): a short read-only summary of likely mistakes in a pattern's color key, often from AI-made patterns.
   Flags only. It never blocks saving and never changes the rows or the user's data. All wording is PLACEHOLDER for Pixel. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPatternCheck=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
// Hue families. A name only "clearly doesn't match" when none of its families equals or neighbours the catalog name's families.
const FAM={black:['black','ebony','jet','onyx'],white:['white','snow','ivory','cream','blanc','ecru','pearl','bone','eggshell'],
 red:['red','scarlet','crimson','cranberry','garnet','cherry','ruby','burgundy','wine','christmas','poppy','cardinal'],
 pink:['pink','rose','blush','salmon','coral','fuchsia','magenta','cerise','carnation','geranium','melon','peach'],
 orange:['orange','tangerine','pumpkin','apricot','burnt','spice','coral','peach','melon','mandarin'],
 yellow:['yellow','lemon','gold','golden','canary','topaz','straw','mustard','butter','buttercup','daffodil','sunflower','corn','cream','old'],
 green:['green','olive','moss','avocado','jade','emerald','fern','pistachio','celadon','parrot','kelly','hunter','forest','mint','sage','lime','pine','seagreen','khaki','teal','grass'],
 blue:['blue','navy','sky','delft','cornflower','wedgwood','turquoise','aquamarine','aqua','teal','peacock','electric','cobalt','sapphire','baby','denim','royal','cyan'],
 purple:['purple','violet','lavender','plum','lilac','mauve','grape','amethyst','orchid','heather','periwinkle','magenta'],
 brown:['brown','tan','beige','mocha','coffee','chocolate','hazelnut','rust','terra','cotta','copper','beaver','khaki','umber','sepia','cocoa','mahogany','golden','sand','camel','fawn','taupe','mushroom','driftwood','ecru','cinnamon','caramel','toast','wheat'],
 gray:['gray','grey','pewter','steel','silver','charcoal','pearl','beaver','ash','slate','smoke','shell']};
const NEAR={black:['gray','brown','blue','purple','green'],white:['gray','yellow','brown','pink'],red:['pink','orange','brown','purple'],pink:['red','purple','orange','white'],
 orange:['red','yellow','brown','pink'],yellow:['orange','green','brown','white'],green:['yellow','blue','gray','brown'],blue:['green','purple','gray'],
 purple:['blue','pink','red','gray'],brown:['orange','red','yellow','gray','black','white','green'],gray:['black','white','brown','blue','green','purple']};
const ALIAS={blanc:'white',bianco:'white',wht:'white',blk:'black',grey:'gray'};
const words=s=>String(s||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean).map(w=>ALIAS[w]||w);
const fams=s=>{const f=new Set();for(const w of words(s))for(const k in FAM)if(FAM[k].includes(w))f.add(k);return f};
// Listed name: the words right after the code on its legend line, before any number or unit.
function listedName(line,code){const t=String(line||'');const re=new RegExp('(?:^|[^\\w])(?:DMC\\s*[:#-]?\\s*)?'+String(code).replace(/[^\w]/g,'')+'\\b','i');const m=re.exec(t);if(!m)return'';
 const after=t.slice(m.index+m[0].length).replace(/\([^)]*\)/g,' ');const n=/^[\s:|,;-]*([A-Za-z][A-Za-z .'&/-]{1,40}?)(?=\s*(?:\d|\||;|,|$|x\b|×))/i.exec(after);if(!n)return'';
 return n[1].replace(/\b(?:skeins?|stitches|strands?|full|cross|dmc|x)\b.*$/i,'').trim()}
function nameMismatch(listed,catalogName){if(!listed)return false;const a=fams(listed),b=fams(catalogName);if(!a.size||!b.size)return false;
 for(const x of a){if(b.has(x))return false;for(const y of b)if((NEAR[y]||[]).includes(x))return false}return true}
// Amounts: the estimate and both thresholds use ONE fabric: the open project's skein settings if set, else 14-count Aida.
function fabricOf(SK,fab){const d={...SK.DEFAULTS,enabled:true,fabric:'aida',count:14,over:1,extraPercent:20};if(!fab)return d;try{const n=SK.normalize(fab);if(n&&SK.validate({...n,enabled:true}).ok)return{...n,enabled:true}}catch(e){}return d}
function fabricLabel(f){return`${f.count}-count ${f.fabric==='aida'?'Aida':'linen or evenweave'}${f.over===2?' over 2':''}`}
function amountCheck(row,SK,fab){if(!SK||!Number.isInteger(row.qty)||!Number.isInteger(row.stitchCount)||row.stitchCount<1)return null;
 const strands=Number.isInteger(row.strandCount)?row.strandCount:undefined,f=fabricOf(SK,fab);const e=SK.compute(row.stitchCount,f,strands);if(!e||e.kind!=='estimate')return null;
 const out={stated:row.qty,est:e.whole,fabric:fabricLabel(f)};
 if(row.qty*1.25<e.base)return{kind:'low',...out};      // generous: stated covers less than 80% of the bare need
 if(row.qty>Math.max(3,e.whole*3))return{kind:'high',...out};return null}
function check(parsed,catalog,SK,fab){const rows=(parsed&&parsed.rows)||[],out={fake:[],dup:[],names:[],amounts:[]};
 for(const s of (parsed&&parsed.skipped)||[]){if(s.reason!=='unrecognized')continue;const m=/\bDMC\s*[:#-]?\s*([A-Za-z]?\d{1,5}[A-Za-z]?)\b/i.exec(s.line)||/^\S{1,3}\s+(\d{1,5})\b/.exec(s.line);if(m&&!(catalog&&catalog[m[1].toUpperCase()])&&!out.fake.includes(m[1].toUpperCase()))/* a real DMC code on a line we couldn't read is not 'not in the catalog' */out.fake.push(m[1].toUpperCase())}
 for(const r of rows){if(r.duplicates&&r.duplicates.length)out.dup.push(r.code);
  const c=catalog&&catalog[r.code];const ln=[r.sourceLine,...(r.duplicates||[]).map(d=>d.line)];
  if(c&&c.name){for(const l of ln){const nm=listedName(l,r.code);if(nameMismatch(nm,c.name)){out.names.push({code:r.code,listed:nm,catalog:c.name});break}}}
  const a=amountCheck(r,SK,fab);if(a)out.amounts.push({code:r.code,...a,stitches:r.stitchCount})}
 out.count=out.fake.length+out.dup.length+out.names.length+out.amounts.length;return out}
// PLACEHOLDER wording for Pixel (plain, short, no em dashes; Pip is they/them).
const sk=n=>`${n} skein${n===1?'':'s'}`;
const STR={title:'Pattern check',clean:"Nothing stands out. It's still worth checking each color against your pattern.",
 fake:l=>`We couldn't find ${l.join(', ')} in the DMC catalog. Check those numbers against your pattern.`,
 dup:l=>`DMC ${l.join(', ')} ${l.length===1?'is':'are'} listed more than once. Check which amount is right.`,
 name:x=>`DMC ${x.code} is listed as "${x.listed}", but the DMC catalog calls it ${x.catalog}. Check which one your pattern means.`,
 amt:x=>`DMC ${x.code} says ${sk(x.stated)} for ${x.stitches} stitches. Our estimate is about ${x.est} on ${x.fabric}, so it may look ${x.kind}.`,
 foot:'This is a quick check, not a guarantee. You can still save.'};
function lines(r){const o=[];if(r.fake.length)o.push(STR.fake(r.fake));if(r.dup.length)o.push(STR.dup(r.dup));r.names.forEach(x=>o.push(STR.name(x)));r.amounts.forEach(x=>o.push(STR.amt(x)));return o}
const HELP=['What is the Pattern check?','After you import a pattern or paste a color key, I look for numbers that aren\'t DMC colors, colors listed twice, names that don\'t match the DMC number, and skein amounts that don\'t fit the stitch count. It only points things out. It never changes your colors and never stops you saving. It can miss things, so still check each color against your pattern.'];
return{fabricOf,fabricLabel,check,lines,listedName,nameMismatch,amountCheck,fams,STR,HELP};
});
if(typeof window!=='undefined')window.FF_PCHECK_HELP=window.FlossFoxPatternCheck.HELP;
