/* Floss Fox merchant register (1.5A). The ONE reviewed place for retailer/affiliate configuration.
   FAIL-CLOSED: a merchant's links can render only when EVERY gate in shop/offers.js passes:
     approvalState 'approved' (merchant-specific, not just the Awin publisher account), termsReviewedAt + termsEvidence,
     trackingLinkSource (official tool, e.g. Awin Toolbox > Link Builder), approvedForProduction:true (Myke's explicit instruction),
     and each link record has a verified https URL on an allowed host with a current linkVerifiedAt.
   There is NO global "affiliates on" switch. Status unknown = off. Nothing here is read from localStorage.
   Public affiliate URLs are public campaign assets; never put passwords, API keys, tokens, payment/tax details here.
   To switch the whole shopping layer off in one reviewed change: set SHOPPING_LAYER:false below. */
window.FLOSS_FOX_ENV='production';
window.FLOSS_FOX_DIRECT_LINKS=true;   // untracked direct Hobby Lobby / Everything Cross Stitch skein links only (tracked:false). Affiliate layer stays off.
window.FLOSS_FOX_SHOP={
 version:'1.5A',
 SHOPPING_LAYER:true,                // global kill switch (true = allowed, but each merchant still needs its own approval)
 linkMaxAgeDays:180,                 // a link not re-checked within this many days is treated as unverified
 merchants:[
  {merchantId:'fatquartershop',displayName:'Fat Quarter Shop',affiliateNetwork:'Awin',programId:'89535',
   approvalState:'applied',approvedForProduction:false,approvedForPreview:false,
   allowedDomains:['fatquartershop.com'],trackingHosts:['www.awin1.com'],destinationParam:'ued',rel:'sponsored noopener',
   termsReviewedAt:null,termsEvidence:null,trackingLinkSource:null,verifiedAt:null,disclosureOverride:null,
   activationNotes:'Applied via Awin (per Myke). Awin listing says content publishers only, no coupon/discount sites. Not confirmed joined.',
   categoryLandings:[],offers:[]},
  {merchantId:'herrschners',displayName:'Herrschners',affiliateNetwork:'Awin',programId:'101041',
   approvalState:'applied',approvedForProduction:false,approvedForPreview:false,
   allowedDomains:['herrschners.com'],trackingHosts:['www.awin1.com'],destinationParam:'ued',rel:'sponsored noopener',
   termsReviewedAt:null,termsEvidence:null,trackingLinkSource:null,verifiedAt:null,disclosureOverride:null,
   activationNotes:'Applied via Awin (per Myke). Not confirmed joined.',categoryLandings:[],offers:[]},
  {merchantId:'leisurearts',displayName:'Leisure Arts',affiliateNetwork:'Awin',programId:'87947',
   approvalState:'applied',approvedForProduction:false,approvedForPreview:false,
   allowedDomains:['leisurearts.com'],trackingHosts:['www.awin1.com'],destinationParam:'ued',rel:'sponsored noopener',
   termsReviewedAt:null,termsEvidence:null,trackingLinkSource:null,verifiedAt:null,disclosureOverride:null,
   activationNotes:'Applied via Awin (per Myke). Not confirmed joined. Checked Oct 11, 2026 (leisurearts.com): the Floss category lists no products and DMC appears only inside kits, so it does NOT carry DMC floss. Keep disabled as a floss merchant; candidate for patterns later (2.0B/C).',categoryLandings:[],offers:[]},
  {merchantId:'michaels',displayName:'Michaels',affiliateNetwork:'unknown',programId:null,
   approvalState:'researching',approvedForProduction:false,approvedForPreview:false,
   allowedDomains:['michaels.com'],trackingHosts:[],destinationParam:null,rel:'sponsored noopener',
   termsReviewedAt:null,termsEvidence:null,trackingLinkSource:null,verifiedAt:null,disclosureOverride:null,
   activationNotes:'Research only. No relationship. (1.3/1.4 search-link prototype retired in 1.5A: it put the thread code in a store query string.)',categoryLandings:[],offers:[]},
  {merchantId:'hobbylobby',displayName:'Hobby Lobby',affiliateNetwork:'unknown',programId:null,
   approvalState:'researching',approvedForProduction:false,approvedForPreview:false,
   allowedDomains:['hobbylobby.com'],trackingHosts:[],destinationParam:null,rel:'sponsored noopener',
   termsReviewedAt:null,termsEvidence:null,trackingLinkSource:null,verifiedAt:null,disclosureOverride:null,
   activationNotes:'Research only. No relationship.',categoryLandings:[],offers:[]}
 ],
 // Creative Fabrica is a pattern-discovery partner, never a floss supplier: kept apart, never mixed into the thread list. Not built in 1.5A.
 patternPartners:[
  {merchantId:'creativefabrica',displayName:'Creative Fabrica',affiliateNetwork:'direct',programId:null,
   approvalState:'researching',approvedForProduction:false,approvedForPreview:false,
   activationNotes:'Inquiry emailed by Myke; acceptance not confirmed. Pattern/learning resources only.'}
 ]
};
