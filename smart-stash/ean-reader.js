/* FlossFox EAN camera fallback. Dependency-free UPC-A, EAN-13, EAN-8 reader.
   Pixel decoder: neither identifies a floss product nor edits inventory. Needs a VERIFIED lookup.
   Tested on generated EAN/UPC fixtures; real packaging QA remains necessary.
   Does not implement Code128, QR, ITF or arbitrary 1D formats. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxEANReader=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PAR=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function check(s){if(!/^\d{8}$|^\d{12}$|^\d{13}$/.test(s))return false;let sum=0;for(let i=s.length-2,m=3;i>=0;i--,m=m===3?1:3)sum+=Number(s[i])*m;return (sum+Number(s.at(-1)))%10===0}
function match(bits,map){return map.indexOf(bits)}
function decodeBits(bits){if(typeof bits!=='string'||!/^[01]+$/.test(bits))return null;
 if(bits.length===95){if(bits.slice(0,3)!=='101'||bits.slice(45,50)!=='01010'||bits.slice(92)!=='101')return null;
  let prefix='',left='',right='',par='';for(let i=0;i<6;i++){const v=bits.slice(3+i*7,10+i*7),l=match(v,L),g=match(v,G);if(l>=0){left+=l;par+='L'}else if(g>=0){left+=g;par+='G'}else return null;}
  const head=PAR.indexOf(par);if(head<0)return null;prefix=String(head);
  for(let i=0;i<6;i++){const d=match(bits.slice(50+i*7,57+i*7),R);if(d<0)return null;right+=d}
  const code=prefix+left+right;return check(code)?{value:code,format:head===0?'ean_13_or_upc_a':'ean_13'}:null;
 }
 if(bits.length===67){if(bits.slice(0,3)!=='101'||bits.slice(31,36)!=='01010'||bits.slice(64)!=='101')return null;let code='';
  for(let i=0;i<4;i++){const d=match(bits.slice(3+i*7,10+i*7),L);if(d<0)return null;code+=d}
  for(let i=0;i<4;i++){const d=match(bits.slice(36+i*7,43+i*7),R);if(d<0)return null;code+=d}
  return check(code)?{value:code,format:'ean_8'}:null;
 }return null;
}
// Detect start guard at a black / white / black run triplet. Evaluate 95 or 67 modules.
function scanRow(gray,threshold){const binary=new Uint8Array(gray.length);for(let i=0;i<gray.length;i++)binary[i]=gray[i]<threshold?1:0;
 let runs=[],start=0,value=binary[0];for(let i=1;i<=binary.length;i++)if(i===binary.length||binary[i]!==value){runs.push({x:start,n:i-start,v:value});start=i;value=binary[i]}
 for(let k=0;k<runs.length-2;k++){const a=runs[k],b=runs[k+1],c=runs[k+2];if(a.v!==1||b.v!==0||c.v!==1)continue;
  const module=(a.n+b.n+c.n)/3;if(module<1||Math.max(a.n,b.n,c.n)/Math.min(a.n,b.n,c.n)>1.7)continue;
  for(const count of [95,67]){if(a.x+module*count>gray.length+2)continue;
   let bits='';for(let i=0;i<count;i++){const pos=Math.floor(a.x+(i+.5)*module);bits+=binary[pos]?'1':'0'}
   const res=decodeBits(bits);if(res)return res;
  }
 }return null}
function decodeImageData(imageData){if(!imageData||!Number.isInteger(imageData.width)||!Number.isInteger(imageData.height)||!imageData.data)return null;
 const {width:w,height:h,data}=imageData;if(w<80||h<8||w*h>16000000)return null;
 const ys=[.5,.32,.68,.2,.8,.42,.58].map(f=>Math.min(h-1,Math.floor(h*f)));
 for(const y of ys){const gray=new Uint8Array(w);let min=255,max=0;for(let x=0;x<w;x++){const p=(y*w+x)*4;gray[x]=Math.round((data[p]*77+data[p+1]*150+data[p+2]*29)/256);min=Math.min(min,gray[x]);max=Math.max(max,gray[x])}
  if(max-min<40)continue;for(const threshold of [Math.floor((max+min)/2),Math.floor(min+(max-min)*.35),Math.floor(min+(max-min)*.65)]){
   let result=scanRow(gray,threshold);if(result)return result;
   result=scanRow(gray.slice().reverse(),threshold);if(result)return result;
  }
 }return null}
return {decodeBits,decodeImageData,check,patterns:{L,G,R,PAR}};
});
