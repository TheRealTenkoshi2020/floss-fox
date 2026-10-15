/* DEV PREVIEW ONLY: synthetic, noncommissionable sample merchants for demonstrating the 1.5A shopping section.
   Hosts use the reserved .example domain (RFC 2606): they resolve nowhere, track nothing, earn nothing.
   offers.js accepts mock merchants only when FLOSS_FOX_ENV==='preview' and only on .example hosts. Never ship this file to production. */
/* Test fixtures only: loaded into the UI only with ?fixtures=1 (or window.FLOSS_FOX_FIXTURES=true set before this script). */
if(window.FLOSS_FOX_FIXTURES===true||/[?&]fixtures=1\b/.test(location.search))window.FLOSS_FOX_SHOP.mockMerchants=[
 {mock:true,merchantId:'sample-floss-shop',displayName:'Sample Floss Shop (demo)',approvalState:'approved',rel:'sponsored noopener',
  allowedDomains:['floss-shop.example'],trackingHosts:['track.network.example'],destinationParam:'ued',
  categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc'],url:'https://floss-shop.example/embroidery-floss/dmc'}],
  offers:[
   {offerId:'sfs-dmc-310',offerType:'exact-product',targetProduct:{brand:'dmc',code:'310',family:'six-strand-cotton',package:'single-skein'},url:'https://track.network.example/click?m=demo&ued=https%3A%2F%2Ffloss-shop.example%2Fdmc-6-strand-cotton-310',evidenceNote:'fixture only'},
   {offerId:'sfs-dmc-321',offerType:'exact-product',targetProduct:{brand:'dmc',code:'321',family:'six-strand-cotton',package:'single-skein'},url:'https://floss-shop.example/dmc-6-strand-cotton-321',evidenceNote:'fixture only'},
   {offerId:'sfs-dmc-assort',offerType:'exact-product',targetProduct:{brand:'dmc',code:'3865',family:'six-strand-cotton',package:'assortment'},url:'https://floss-shop.example/dmc-starter-pack',evidenceNote:'fixture: assortment, must never satisfy a single code'}]},
 {mock:true,merchantId:'example-craft-store',displayName:'Example Craft Store (demo)',approvalState:'approved',rel:'sponsored noopener',
  allowedDomains:['craft-store.example'],trackingHosts:[],destinationParam:null,
  categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc','anchor'],url:'https://craft-store.example/thread/embroidery-floss'}],offers:[]},
 {mock:true,merchantId:'suspended-sample',displayName:'Suspended Sample (demo)',approvalState:'suspended',rel:'sponsored noopener',
  allowedDomains:['suspended.example'],categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc'],url:'https://suspended.example/floss'}],offers:[]}
];
