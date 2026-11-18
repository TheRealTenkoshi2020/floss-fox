/* Smart Stash Premium client entitlement adapter — DENY BY DEFAULT.
   Only a server-authenticated session can grant paid feature access.
   Expects same-origin GET /v1/entitlements?features=smartstash
   authenticated by HttpOnly Secure SameSite session cookies, and reply:
   {active:true,features:['smartstash.photo','smartstash.barcode'],expiresAt:'ISO UTC'}
   No billing credentials, no plan flags and no tokens are stored in localStorage.
   This is a paid UX gate, NOT cryptographic DRM for browser-delivered local code.
*/
(function(root){'use strict';const URL_PATH='/v1/entitlements?features=smartstash';
async function hasAccess(name){if(!['photo','barcode'].includes(name)||!root.isSecureContext)return false;
 let abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6500);
 try{const response=await root.fetch(URL_PATH,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:abort.signal});
  if(!response.ok||!String(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))return false;
  if(Number(response.headers.get('content-length')||0)>12000)return false;
  const d=await response.json();if(!d||d.active!==true||!Array.isArray(d.features)||d.features.length>20||typeof d.expiresAt!=='string')return false;
  const until=Date.parse(d.expiresAt);if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+24*60*60*1000)return false;
  return d.features.includes('smartstash.'+name);
 }catch{return false}finally{clearTimeout(timer)}
}
root.FlossFoxSmartStashPremiumBridge=Object.freeze({hasAccess});
})(typeof window!=='undefined'?window:globalThis);
