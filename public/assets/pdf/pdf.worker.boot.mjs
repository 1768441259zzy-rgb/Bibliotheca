/**
 * Worker entry: polyfill Map/WeakMap APIs before PDF.js 6 worker runs.
 * Chrome/Edge < 145 do not implement getOrInsertComputed yet.
 */
(() => {
  const patch = (proto) => {
    if (typeof proto.getOrInsert !== 'function') {
      proto.getOrInsert = function getOrInsert(key, value) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      };
    }
    if (typeof proto.getOrInsertComputed !== 'function') {
      proto.getOrInsertComputed = function getOrInsertComputed(key, callbackfn) {
        if (!this.has(key)) this.set(key, callbackfn(key));
        return this.get(key);
      };
    }
  };
  patch(Map.prototype);
  patch(WeakMap.prototype);
})();

import './pdf.worker.min.mjs';
