/* Production build setting. Photo recognition and barcode scanning are free for everyone for now.
   This is a committed build constant, not an entitlement and not a localStorage flag.
   The entitlement check in smart-stash/premium-bridge.js stays in place for later.
   Honored on every host. No prices, checkout, or upgrade copy. */
(function(root){'use strict';
  root.FlossFoxBuildConfig=Object.freeze({channel:'production',premiumFreeDuringTesting:true});
})(window);
