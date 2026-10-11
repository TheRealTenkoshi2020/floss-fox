/* Floss Fox retailer links: the ONE place to configure store links.
   Production default: every retailer disabled, so no store links and no disclosure are shown.
   To go live with a retailer after approval:
     1. set enabled:true
     2. put your network ID in affiliateId (replace the placeholder)
     3. set wrap to the network's deep-link format; {id} = affiliateId, {url} = encoded retailer URL.
        Leave wrap '' to link straight to the store (untracked).
   Links never claim stock, price or availability: they open a store search for the thread. */
window.FLOSS_FOX_RETAILERS=[
 {id:'michaels',name:'Michaels',enabled:false,brands:['dmc'],network:'CJ Affiliate',
  affiliateId:'AFFILIATE_ID_PLACEHOLDER',wrap:'',
  // Product pages exist per DMC colour (e.g. /product/dmc-6-strand-embroidery-floss-dark-10031295 for 310) but IDs can't be derived from the colour number, so use search.
  template:'https://www.michaels.com/search?q={q}'},
 {id:'hobbylobby',name:'Hobby Lobby',enabled:false,brands:['dmc'],network:'CJ Affiliate',
  affiliateId:'AFFILIATE_ID_PLACEHOLDER',wrap:'',
  template:'https://www.hobbylobby.com/search?query={q}'}
];
window.FLOSS_FOX_TEST_LINKS=false; // true only in the dev preview: labels links as untracked test links
