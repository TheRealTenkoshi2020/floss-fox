/* Floss Fox FTUX: recoverable scratchpad core. No server, no project writes.
 * This module is intentionally separate from flossfox.v1 / flossfox.threads.v1.
 * It never overwrites malformed/unknown-version saved drafts.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxDraftCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const MAX_CHARS = 80000;
  function valid(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== VERSION) return false;
    return typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= MAX_CHARS &&
      typeof value.updatedAt === 'number' && Number.isSafeInteger(value.updatedAt) && value.updatedAt >= 0 &&
      typeof value.brand === 'string' && /^[a-z0-9_-]{1,32}$/.test(value.brand);
  }
  function store(adapter, key, now = Date.now) {
    if (!adapter || !key || typeof key !== 'string') throw new Error('Storage adapter and key required');
    function read() {
      let raw;
      try { raw = adapter.getItem(key); } catch (_) { return {status:'unavailable'}; }
      if (raw === null) return {status:'empty'};
      try { const item = JSON.parse(raw); return valid(item) ? {status:'ok', item} : {status:'protected'}; }
      catch (_) { return {status:'protected'}; }
    }
    function save(text, brand = 'dmc') {
      if (typeof text !== 'string') return {ok:false,reason:'invalid-input'};
      if (!text.trim()) return {ok:false,reason:'empty-use-clear'};
      if (text.length > MAX_CHARS || !/^[a-z0-9_-]{1,32}$/.test(brand)) return {ok:false,reason:'invalid-input'};
      const prior = read();
      if (prior.status !== 'empty' && prior.status !== 'ok') return {ok:false,reason:prior.status};
      const timestamp = now();
      if (!Number.isSafeInteger(timestamp) || timestamp < 0) return {ok:false,reason:'invalid-clock'};
      const item = {schema:VERSION,text,brand,updatedAt:timestamp};
      try { adapter.setItem(key,JSON.stringify(item)); return {ok:true,item}; }
      catch (_) { return {ok:false,reason:'write-failed'}; }
    }
    function clear({force = false} = {}) {
      const prior = read();
      if (!force && prior.status === 'protected') return {ok:false,reason:'protected'};
      try {adapter.removeItem(key); return {ok:true};}
      catch (_) {return {ok:false,reason:'write-failed'};}
    }
    return {read,save,clear,key};
  }
  function shouldOfferRecovery(currentText, record, inExampleMode) {
    return !inExampleMode && !String(currentText || '').trim() && record && record.status === 'ok';
  }
  return {VERSION, MAX_CHARS, valid, store, shouldOfferRecovery};
});
