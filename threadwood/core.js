/* FlossFox Threadwood: pure and deterministic keepsake/session logic. MIT-style project-local source.
   No network, no analytics, no dependency. In Node: require('./core.js'). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxThreadwoodCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA=1, MAX_ENTRIES=75, MAX_SESSIONS=250, MAX_PHOTO=180000, MAX_TOTAL_PHOTOS=2400000;
const clean=(v,n)=>String(v===undefined||v===null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s));
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{6,64}$/.test(s);
const safePhoto=s=>typeof s==='string'&&s.length<=MAX_PHOTO&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(s);
function empty(){return{schema:SCHEMA,entries:[],sessions:[],favorites:[],draft:{seconds:0,projectId:''}}}
function entry(e){if(!e||!validId(e.id)||!validDate(e.at))return null;
 const note=clean(e.note,550),projectId=clean(e.projectId,80),projectName=clean(e.projectName,120),progressPct=Number.isInteger(e.progressPct)&&e.progressPct>=0&&e.progressPct<=100?e.progressPct:null;
 if(e.photo!==undefined&&e.photo!==''&&!safePhoto(e.photo))return null;
 const photo=e.photo||'';
 if(!note&&!photo)return null;
 return{id:e.id,at:e.at,note,projectId,projectName,progressPct,photo};}
function session(e){if(!e||!validId(e.id)||!validDate(e.at)||!Number.isInteger(e.seconds)||e.seconds<1||e.seconds>86400)return null;
 return{id:e.id,at:e.at,seconds:e.seconds,projectId:clean(e.projectId,80),projectName:clean(e.projectName,120)};}
function normalize(s){if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Threadwood backup must be a JSON object.');
 if(s.schema!==SCHEMA)throw Error('This Threadwood version cannot read that backup schema; existing memories were not changed.');
 if(!Array.isArray(s.entries)||!Array.isArray(s.sessions)||!Array.isArray(s.favorites))throw Error('The memories file has missing or invalid lists.');
 if(s.entries.length>MAX_ENTRIES||s.sessions.length>MAX_SESSIONS||s.favorites.length>80)throw Error('The memories file exceeds safe collection limits.');
 const ids=new Set(),entries=[];let bytes=0;
 for(const e of s.entries){const n=entry(e);if(!n||ids.has(n.id))throw Error('The memories file has an invalid or repeated keepsake.');ids.add(n.id);bytes+=n.photo.length;if(bytes>MAX_TOTAL_PHOTOS)throw Error('The memories file contains too many photos for device storage.');entries.push(n)}
 const sessions=[];for(const e of s.sessions){const n=session(e);if(!n||ids.has(n.id))throw Error('The memories file has an invalid or repeated session.');ids.add(n.id);sessions.push(n)}
 const favorites=[];for(const x of s.favorites){if(typeof x!=='string'||!/^[a-z0-9_-]{1,40}$/.test(x))throw Error('The memories file has invalid favorites.');if(!favorites.includes(x))favorites.push(x)}
 const d=s.draft||{},seconds=Number.isInteger(d.seconds)&&d.seconds>=0&&d.seconds<=86400?d.seconds:0;
 return{schema:SCHEMA,entries,sessions,favorites,draft:{seconds,projectId:clean(d.projectId,80)}};
}
function pushEntry(state,e){const a=normalize(state),next=entry(e);if(!next)throw Error('Add a note or photograph before saving this moment.');
 if(a.entries.length>=MAX_ENTRIES)throw Error('The keepsake limit has been reached. Export a copy before clearing old entries.');
 a.entries.unshift(next);return normalize(a)}
function pushSession(state,e){const a=normalize(state),next=session(e);if(!next)throw Error('The session duration or date is invalid.');
 if(a.sessions.length>=MAX_SESSIONS)throw Error('The saved-session limit has been reached. Export a copy before clearing old sessions.');a.sessions.unshift(next);return normalize(a)}
function removeRecord(state,id,type){const a=normalize(state);if(type==='entry')a.entries=a.entries.filter(x=>x.id!==id);else if(type==='session')a.sessions=a.sessions.filter(x=>x.id!==id);else throw Error('Unknown record type');return a}
function updateNote(state,id,note){const a=normalize(state),e=a.entries.find(x=>x.id===id);if(!e)throw Error('This keepsake is no longer available.');e.note=clean(note,550);if(!e.note&&!e.photo)throw Error('A keepsake needs a note or a photograph.');return a}
function toggleFavorite(state,id,allowed){const a=normalize(state);if(!allowed.includes(id))throw Error('Unknown discovery');a.favorites=a.favorites.includes(id)?a.favorites.filter(x=>x!==id):[...a.favorites,id].slice(0,80);return a}
function timeLabel(seconds){if(!Number.isFinite(seconds)||seconds<=0)return 'No time logged';const s=Math.round(seconds);if(s<60)return 'Under a minute';const min=Math.floor(s/60),h=Math.floor(min/60),m=min%60;return h?(h+'h'+(m?' '+m+'m':'')):(min+' min')}
function projectList(api){let list=[];try{const v=api&&api._store&&api._store();list=v&&Array.isArray(v.projects)?v.projects:[]}catch(e){}return list.filter(p=>p&&typeof p.id==='string'&&!p.demo).map(p=>({id:p.id,name:clean(p.name,120)||'Untitled project',status:['planning','ready','progress','done'].includes(p.status)?p.status:'planning',progressPct:Number.isInteger(p.progressPct)&&p.progressPct>=0&&p.progressPct<=100?p.progressPct:null,updated:validDate(p.updated)?p.updated:''})).sort((a,b)=>b.updated.localeCompare(a.updated))}
function welcome(projects,threads){const active=projects.find(p=>p.status!=='done');if(active)return{title:'Welcome to Pip\'s Den',line:'Your '+active.name+' is right where you left it.',action:'Continue '+active.name,projectId:active.id};
 if(projects.length)return{title:'Welcome back to the Threadwood',line:'Your finished projects are here whenever you want to revisit them.',action:'See my projects',projectId:''};
 return{title:'Welcome to Pip\'s Den',line:threads>0?'Your thread collection is waiting for its first project.':'There\'s no rush. We can explore a little or start something new.',action:'Start a project',projectId:''}}
function dayIndex(day,length){if(!length)return 0;let h=17;for(const c of String(day))h=(h*33+c.charCodeAt(0))>>>0;return h%length}
return{SCHEMA,MAX_PHOTO,MAX_ENTRIES,MAX_SESSIONS,empty,normalize,entry,session,pushEntry,pushSession,removeRecord,updateNote,toggleFavorite,timeLabel,projectList,welcome,dayIndex,safePhoto};
});
