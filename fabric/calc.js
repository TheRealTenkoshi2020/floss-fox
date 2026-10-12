/* Pip's Fabric Calculator: pure math (no DOM, no storage, no network). Browser: window.FlossFoxFabric; Node: module.exports.
   All values are kept at full precision in INCHES; cm is only ever derived for display (cm = in * 2.54), so unit switching never drifts.
   effective = count / threadsCrossed;  design = stitches / effective;  exact cut = design + 2 * marginPerSide;
   recommended cut = exact cut rounded UP to the next 1/4 inch; its cm value is derived from that rounded-up inch value. */
(function(root){
'use strict';
const CM=2.54;
const LIMITS={stitchesMin:1,stitchesMax:2000,countMin:6,countMax:60,marginMinIn:0,marginMaxIn:12,over:[1,2]};
const AIDA=[11,14,16,18],EVEN=[25,28,32,36];
const PRESETS={small:1,hoop:2,framing:3};              // inches per side
// Parse a user string strictly. Returns {ok, value, error}.
function parseWhole(s,min,max,name){
 const t=String(s==null?'':s).trim();if(t==='')return{ok:false,error:`Enter the ${name}.`};
 if(!/^\d+$/.test(t))return{ok:false,error:/^-/.test(t)?`The ${name} can't be negative.`:/[.,]/.test(t)?`Use a whole number of stitches for the ${name}.`:`Use numbers only for the ${name}.`};
 const v=Number(t);if(v<min)return{ok:false,error:`The ${name} must be at least ${min}.`};if(v>max)return{ok:false,error:`The ${name} can be at most ${max} stitches.`};return{ok:true,value:v}}
function parseNum(s,min,max,name,unit){
 const t=String(s==null?'':s).trim().replace(',','.');if(t==='')return{ok:false,error:`Enter the ${name}.`};
 if(!/^-?\d*\.?\d+$/.test(t))return{ok:false,error:`Use a number for the ${name}.`};const v=Number(t);
 if(!isFinite(v))return{ok:false,error:`Use a number for the ${name}.`};if(v<min)return{ok:false,error:min===0?`The ${name} can't be negative.`:`The ${name} must be at least ${min}${unit||''}.`};
 if(v>max)return{ok:false,error:`The ${name} can be at most ${max}${unit||''}.`};return{ok:true,value:v}}
const effective=(count,over)=>count/over;
const designIn=(st,count,over)=>st/effective(count,over);
const ceilQuarter=x=>Math.ceil(x*4-1e-9)/4;           // tolerance only absorbs float noise (e.g. 13.25000000001)
const toCm=i=>i*CM,fromCm=c=>c/CM;
function compute(o){
 // o: {w,h (stitches), count, over (1|2), marginIn (per side, inches)}
 const eff=effective(o.count,o.over),dw=o.w/eff,dh=o.h/eff,ew=dw+2*o.marginIn,eh=dh+2*o.marginIn,rw=ceilQuarter(ew),rh=ceilQuarter(eh);
 return{effective:eff,design:{w:dw,h:dh,wCm:toCm(dw),hCm:toCm(dh)},cutExact:{w:ew,h:eh},cut:{w:rw,h:rh,wCm:toCm(rw),hCm:toCm(rh)},marginIn:o.marginIn,marginTotalIn:2*o.marginIn}}
function others(w,h){return AIDA.map(c=>{const e=EVEN.find(x=>x/2===c)||c*2;return{aida:c,evenweave:e,evenEffective:e/2,w:w/c,h:h/c,ew:w/(e/2),eh:h/(e/2)}})}
// Display formatting only (never fed back into the math).
const fmt=(x,d)=>{const r=Math.round(x*Math.pow(10,d))/Math.pow(10,d);return String(+r.toFixed(d))};
function fmtIn(x){const q=Math.round(x*4)/4;return Math.abs(q-x)<1e-9?fracIn(q):fmt(x,2)}
function fracIn(q){const w=Math.floor(q),f=Math.round((q-w)*4);const F=['','¼','½','¾'][f];return (w||!F?String(w):'')+F}
const api={CM,LIMITS,AIDA,EVEN,PRESETS,parseWhole,parseNum,effective,designIn,ceilQuarter,toCm,fromCm,compute,others,fmt,fmtIn};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FlossFoxFabric=api;
})(typeof window!=='undefined'?window:this);
