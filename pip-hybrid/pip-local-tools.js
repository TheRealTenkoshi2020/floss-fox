/* Pip local deterministic tools v0.2: ZERO storage, ZERO network, no inferred
 * thread consumption. An optional narrow Aida design/cut size calculator.
 * Never replaces the real Floss Fox Fabric calculator.
 */
(function(root){
 'use strict';
 const rxDim=/\b(\d{1,4})\s*(?:x|×|by)\s*(\d{1,4})\s*(?:stitches|crosses|stitch)?\b/i;
 const rxCount=/\b(\d{1,2})\s*(?:-|\s)?\s*(?:count|ct)\s+aida\b/i;
 const rxMarginA=/\b(?:margin|border|allowance)\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\b|\")/i;
 const rxMarginB=/\b(\d+(?:\.\d+)?)\s*(?:inches|inch|in\b|\")\s*(?:margin|border|allowance)\b/i;
 const round=x=>Math.round((x+Number.EPSILON)*100)/100;
 const fmt=x=>round(x).toFixed(2).replace(/\.00$/,'');
 function answer(q){
  const s=String(q||'');if(s.length>600||/\b(?:over\s*(?:2|two)|evenweave|linen)\b/i.test(s))return null;
  if(!/\b(?:fabric|aida|stitch|pattern|design|size|cut|wide|tall)\b/i.test(s))return null;
  const d=rxDim.exec(s),c=rxCount.exec(s);if(!d||!c)return null;
  const width=Number(d[1]),height=Number(d[2]),count=Number(c[1]);
  if(width<1||height<1||width>2000||height>2000||count<6||count>36)return null;
  // Prevent silent misuse for patterns described in centimeters/inches, not stitches.
  const span=s.slice(d.index,d.index+d[0].length+15);
  if(/\b(?:cm|mm|inch(?:es)?|in\b)\b/i.test(span)&&!/\b(?:stitches|crosses|stitch)\b/i.test(d[0]))return null;
  const designW=width/count,designH=height/count;
  const m=rxMarginA.exec(s)||rxMarginB.exec(s);let margin=null;
  if(m){margin=Number(m[1]);if(!Number.isFinite(margin)||margin<0||margin>12)return null}
  let text=`For ${width} × ${height} stitches on ${count}-count Aida (stitched over one square), the design area is ${fmt(designW)} × ${fmt(designH)} inches (${fmt(designW*2.54)} × ${fmt(designH*2.54)} cm).`;
  if(margin===null){text+=' This is the stitched design only, not how much fabric to cut. Add a margin on every side for finishing or framing; the Fabric calculator can plan the cut for you.'}
  else{
   const cutW=Math.ceil((designW+margin*2)*4-1e-9)/4,cutH=Math.ceil((designH+margin*2)*4-1e-9)/4;
   text+=` With ${fmt(margin)} inches of extra fabric on each side, the minimum cut is ${fmt(designW+2*margin)} × ${fmt(designH+2*margin)} inches. Rounded up to the next quarter inch: ${fmt(cutW)} × ${fmt(cutH)} inches. Allow extra for your finishing method and any shrinkage.`;
  }
  return {id:'aida-size',title:'Aida design size',answer:text,source:'local calculation',actions:[{label:'Open Fabric calculator',href:'fabric.html'}]};
 }
 const api=Object.freeze({answer});root.FlossFoxPipLocalTools=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
