/* ---- Key map used by the code (FF_STR). Values come from Pixel's FF_P12 where Pixel wrote one.
   Anything marked PLACEHOLDER has no Pixel copy yet; see /workspace/flow-p12/STRINGS_FOR_PIXEL.md. ---- */
/* new-15 pose swap (Pixel's placement plan): My threads Pip strip, organizing -> floss-box. Art only, copy unchanged.
   (The p12.screen.* poses are not drawn anywhere, so the swap goes on the strip lines that really show.) */
(()=>{const M=window.FF_P12_META||{};['p12.bubble.threads.empty.1','p12.bubble.threads.has.1'].forEach(k=>{if(M[k]&&M[k].pose==='organizing')M[k].pose='floss-box'})})();
(function(){const P=window.FF_P12||{},p=k=>P[k],PH=s=>s; /* PH() = PLACEHOLDER */
const help=(k,sk)=>({title:p(`p12.screen.${k}.title`),eli5:p(`p12.screen.${k}.body`),doNext:p(`p12.screen.${k}.next`),pose:(window.FF_P12_META[`p12.screen.${k}.title`]||{}).pose});
window.FF_STR={
 // (a) auto-compare banner (Pixel)
 compare:{many:p('p12.flow.compare.banner.many'),none:p('p12.flow.compare.banner.none'),oneHave:p('p12.flow.compare.banner.one_have'),oneNot:p('p12.flow.compare.banner.one_not'),
  unsure:p('p12.flow.compare.detail.unsure'),filled:p('p12.flow.compare.detail.filled'),buy:p('p12.flow.compare.detail.buy'),same:p('p12.flow.compare.detail.same'),undo:p('p12.flow.compare.undo'),undoAria:p('p12.flow.compare.undo_aria'),
  undoHint:p('p12.flow.compare.undo_hint'),undone:p('p12.flow.compare.undone'),nothing:p('p12.flow.compare.nothing'),empty:p('p12.flow.compare.empty'),emptyBtn:p('p12.flow.compare.empty_btn'),reserved:p('p12.flow.compare.reserved')},
 autoOffer:p('p12.flow.auto.offer'),
 autoApply:p('p12.flow.auto.apply'),
 autoDismiss:p('p12.flow.auto.dismiss'),
 // (b) shopping (Pixel)
 shopPickLabel:p('p12.flow.shop.picker.label'),shopSeveral:p('p12.flow.shop.picker.several'),
 shopEmptyTitle:p('p12.flow.shop.empty.title'),shopEmptyBody:p('p12.flow.shop.empty.body'),shopEmptyProjects:p('p12.flow.shop.empty.btn1'),shopEmptyPaste:p('p12.flow.shop.empty.btn2'),
 shopPickNone:p('p12.flow.shop.picker.none'),
 // (c) Next (Pixel)
 next:{find:p('p12.flow.next.find'),review:p('p12.flow.next.review'),cmp:p('p12.flow.next.cmp'),ready:p('p12.flow.next.ready'),shop:p('p12.flow.next.shop')},
 nextThreads:p('p12.flow.next.threads'),nextThreadsHasProj:p('p12.flow.next.threads_has'),
 // (d) import
 importLabel:'Import a pattern (PDF)',
 // (e) save + name (Pixel)
 savedOk:p('p12.flow.saved.ok'),savedBadge:p('p12.flow.saved.badge'),savedFail:p('p12.flow.saved.fail'),
 nameLabel:p('p12.flow.name.label'),namePlaceholder:p('p12.flow.name.placeholder'),
 /* Myke's spec: default "My project"; Pixel's hint said "Untitled project", so the name is substituted here. Flagged for Pixel. */
 nameHint:p('p12.flow.name.hint'),nameHintImport:p('p12.flow.name.hint_import'),
 defaultName:p('p12.flow.name.default'),rename:p('p12.flow.name.rename'),
 // (f) per-screen help (Pixel); topics are PLACEHOLDER
 help:{convert:help('find'),results:help('results'),threads:help('threads'),projects:help('projects'),project:help('project'),readiness:help('readiness'),shop:help('shopping'),fabric:help('fabric'),import:help('import'),backup:help('backup'),help:help('help')},
 helpAlt:{findHasText:p('p12.screen.find.next_hastext'),projectsHas:p('p12.screen.projects.next_has'),projectsHasFallback:p('p12.screen.projects.next_has_fallback'),projectNextAlt:p('p12.screen.project.next_alt')},
 topics:Object.fromEntries(['convert','projects','project','shop'].map(k=>[k,[[p(`p12.topic.${k}.1.q`),p(`p12.topic.${k}.1.a`)]]])),
 askPipFabric:p('p12.ui.askpip_fabric'),pipHelpBtn:p('p12.ui.import_help_btn'),pipHelpClose:p('p12.ui.close'),
 // bubble lines (Pixel), chosen by tab then condition
 bubble:P,
 // (g) terms (Pixel)
 terms:{dmc:[p('p12.term.dmc.label'),p('p12.term.dmc.text')],skein:[p('p12.term.skein.label'),p('p12.term.skein.text')],legend:[p('p12.term.legend.label'),p('p12.term.legend.text')],
  strands:[p('p12.term.strands.label'),p('p12.term.strands.text')],count:[p('p12.term.fabric_count.label'),p('p12.term.fabric_count.text')],
  attention:[p('p12.term.needs_attention.label'),p('p12.term.needs_attention.text')],readiness:[p('p12.term.readiness.label'),p('p12.term.readiness.text')]},
 termChipLabel:p('p12.ui.term_chip_aria'),termClose:p('p12.ui.term_close'),
 // (h) tour (Pixel)
 tour:[1,2,3,4,5].map(i=>({title:p(`p12.tour.${i}.title`),body:p(`p12.tour.${i}.body`)})),tourInvite:p('p12.tour.invite'),
 left:{catalog:p('p12.left.catalog_fallback'),imageStatus:p('p12.left.image_status'),imageWarning:p('p12.left.image_warning'),helpPdf:p('p12.left.help_pdf'),modalDesc:p('p12.left.modal_desc_pdf')}
};})();
