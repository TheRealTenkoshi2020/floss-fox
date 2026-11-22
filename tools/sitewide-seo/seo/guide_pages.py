"""Hand-authored, static, user-facing Floss Fox guides; zero runtime dependencies."""
from html import escape
import json

BASE='https://flossfox.com/'
STYLES='''
:root{color-scheme:light;--bg:#f7f1e6;--paper:#fffaf2;--ink:#352f29;--muted:#57544f;--line:#d5c9b7;--accent:#7a3f24;--link:#265f52}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--link);text-underline-offset:3px}a:focus-visible{outline:3px solid #be6c3b;outline-offset:3px}
.wrap{max-width:900px;margin:auto;padding:16px 18px 60px}header{display:flex;gap:16px;align-items:center;border-bottom:1px solid var(--line);padding:10px 0 16px}header img{width:65px;height:65px;object-fit:contain}
.brand{font-size:1.18rem;font-weight:800;letter-spacing:.03em}.nav{display:flex;gap:10px 18px;flex-wrap:wrap;font-size:.92rem}.eyebrow{font-size:.82rem;font-weight:750;text-transform:uppercase;letter-spacing:.11em;color:var(--accent)}
h1{font-size:clamp(1.7rem,5vw,2.65rem);line-height:1.2;letter-spacing:-.02em;margin:20px 0 8px}h2{font-size:1.36rem;line-height:1.3;margin:1.9em 0 .5em}h3{font-size:1.08rem;line-height:1.3;margin:1.2em 0 .4em}
p{margin:.7em 0 1em}li{margin:.45em 0}ul,ol{padding-left:1.6em}.lede{font-size:1.14rem;max-width:45em}.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px 22px;margin:18px 0}.cta{background:#eaf0e8;border-color:#b6ceba}
.cta a{display:inline-block;padding:10px 15px;background:#315e46;border-radius:999px;color:#fff;font-weight:750;text-decoration:none;margin:6px 10px 6px 0;min-height:44px}
.crumbs{font-size:.82rem;margin:18px 0}footer{margin-top:40px;padding-top:15px;border-top:1px solid var(--line);font-size:.9rem}footer a{margin-right:12px}
.muted{color:var(--muted)}@media(max-width:520px){body{font-size:16px}.wrap{padding:12px 14px 40px}.card{padding:14px 16px}header{align-items:flex-start}header img{width:52px;height:52px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
'''
GUIDES={
 'tools.html':{
   'title':'Free Cross-Stitch Tools & Guides | Floss Fox',
   'description':'Find free cross-stitch tools for floss conversion, thread inventory, project planning, shopping lists and fabric size calculations with Pip.',
   'heading':'Cross-stitch tools, all in one cozy place',
   'lede':'Meet Pip, your friendly fox guide. Whether you are sorting skeins, preparing a new pattern or working out how much fabric to cut, start with the tool that helps today.',
   'body':'''<section class="card"><h2>Choose what you need</h2>
   <h3>Find floss and compare brands</h3><p>Working from a DMC pattern? Look up chart-listed Anchor and Sullivans matches, review the limitations, and decide what to buy. <a href="index.html#convert">Open Find Floss</a> or read the <a href="floss-conversion-guide.html">floss conversion guide</a>.</p>
   <h3>Organize your thread collection</h3><p>Record DMC numbers, full and partial skeins, and where your threads live. Bring an existing list into your collection, then keep a backup. <a href="index.html#threads">Open My Threads</a> or read the <a href="thread-inventory-guide.html">inventory guide</a>.</p>
   <h3>Plan a cross-stitch project</h3><p>Save your pattern thread list, compare it with your stash, and gather missing skeins into a combined shopping list. Keep a stitching journal and update your progress when you choose. <a href="index.html#projects">Open My Projects</a> or follow the <a href="cross-stitch-project-planning.html">planning guide</a>.</p>
   <h3>Calculate fabric size</h3><p>Enter the design's stitch dimensions, fabric count and finishing margins to calculate a cutting size. <a href="fabric.html">Open Pip's fabric calculator</a>.</p></section>
   <section class="card"><h2>Do I need an account?</h2><p>The free core tools work without signing up. Projects and thread information are generally saved in the browser on your device, so export a backup if you want to protect or move your work. See <a href="privacy.html">privacy and storage details</a>.</p></section>
   <section class="card"><h2>A note about color matches</h2><p>Conversion tables suggest possible substitutes, not guaranteed visual equivalents. Dye lots, lighting and floss types matter. For large or important pieces, compare actual skeins before purchasing.</p></section>'''
 },
 'floss-conversion-guide.html':{
   'title':'DMC to Anchor Floss Conversion Guide | Floss Fox',
   'description':'Learn how DMC, Anchor and Sullivans embroidery floss conversions work, why some matches differ, and how to check substitutes before stitching.',
   'heading':'A gentle guide to floss color conversion',
   'lede':'Your pattern calls for one brand, but your shop carries another. A conversion chart can help you find a starting point, without pretending every thread is a perfect match.',
   'body':'''<section class="card"><h2>What a floss conversion chart does</h2><p>Cross-stitch patterns commonly list thread colors using a brand and number, such as DMC. A conversion chart pairs those codes with suggested colors in another brand, such as Anchor or Sullivans. The number is a reference within that brand, not a universal shade code.</p>
   <p>Floss Fox uses published DMC-to-Anchor and DMC-to-Sullivans chart mappings. A chart-listed pairing is not a promise that two skeins look identical. Some colors have no verified pairing in the source data.</p></section>
   <section class="card"><h2>How to choose a substitute</h2><ol><li><strong>Check the pattern key.</strong> Confirm the original brand, number and thread type.</li><li><strong>Look up chart-listed matches.</strong> Enter the DMC number in <a href="index.html#convert">Find Floss</a> and review any alternatives shown.</li><li><strong>Compare real thread in your lighting.</strong> Phone screens and printed swatches can differ from physical skeins; judge near the fabric you will use.</li><li><strong>Keep close shades together.</strong> If your design blends several similar colors, consider substituting the group carefully rather than swapping isolated shades.</li><li><strong>Record your decision.</strong> Keep the final brand and code with your project so shopping and restocking are less confusing.</li></ol></section>
   <section class="card"><h2>Special colors deserve extra care</h2><p>DMC BLANC and WHITE are distinct catalog codes. Preserve them separately when copying lists. Metallic, variegated and specialty threads may behave and reflect light differently from ordinary stranded cotton; do not assume a standard cotton conversion preserves the intended effect.</p>
   <p>For shades without a verified mapping, a responsible result is “no confirmed chart match,” not an invented near-equivalent.</p></section>
   <section class="card"><h2>Compare a screen color with DMC swatches</h2><p>The optional color tool in Settings compares a six-digit HEX color with DMC screen swatches using CIEDE2000 color distance. Its results are estimates, not approved thread equivalents or measurements of physical skeins. Published brand conversions remain separate. Compare real thread before choosing a substitute.</p></section>
   <section class="card"><h2>Suggest a better thread match</h2><p>If you have compared actual skeins, open Help and choose “Suggest a better thread match.” You can copy a report with the brand, codes and your observations. It stays on your device until you choose where to send it; copying does not submit feedback or change the conversion tables.</p></section>
   <section class="card"><h2>What about price and availability?</h2><p>A cheaper skein may save money, but swapping every color in a detailed design can affect the final appearance. Check your existing <a href="index.html#threads">thread collection</a> first, then use a <a href="index.html#shop">shopping list</a> for what is truly missing. Store inventory and prices can change, so verify them directly with the retailer.</p></section>'''
 },
 'thread-inventory-guide.html':{
   'title':'How to Organize Cross-Stitch Floss Inventory | Floss Fox',
   'description':'Organize DMC floss by number, track full and partial skeins, label bobbins, import a thread list and keep a backup of your cross-stitch stash.',
   'heading':'How to organize and track your floss collection',
   'lede':'Your thread collection can be a treasure box rather than a mystery. A little numbering and a simple inventory makes it easier to know what you own before starting a new piece.',
   'body':'''<section class="card"><h2>Start with numbers, not just colors</h2><p>Some floss shades look nearly identical under warm light. Keep each skein's brand and printed color number attached to its bobbin, bag or organizer. Avoid identifying an unlabelled skein by appearance alone when the project depends on a precise match.</p>
   <p>Choose a storage system that fits your habits: numbered bobbins in compartments, skeins grouped by number, or project bags. The best system is one you can actually maintain.</p></section>
   <section class="card"><h2>What to record</h2><ul><li><strong>Brand and color number:</strong> a DMC 310 is different from a similarly numbered thread in another brand.</li><li><strong>Full skeins:</strong> count unopened or confidently complete skeins separately from partial ones.</li><li><strong>Partial skeins:</strong> mark an opened skein without pretending its remaining length is exact.</li><li><strong>Storage location:</strong> note which box, drawer, row or project bag holds the thread.</li><li><strong>Restock note:</strong> keep a separate reminder for shades you want more of.</li></ul></section>
   <section class="card"><h2>Bring in an existing list</h2><p>If you already use a spreadsheet or another tracker, start with that work rather than retyping everything. In My Threads, choose “Import a list” to review compatible CSV, TSV, TXT, JSON or XLSX files. You can also paste a list. Verify the column for thread number, the original brand and whether a quantity means skeins or stitches before you confirm any changes.</p>
   <p>Review duplicates and unexpected quantities. If your list records only which colors you own, leave counts unconfirmed until you check your collection.</p></section>
   <section class="card"><h2>Keep your inventory useful</h2><ol><li>Add newly purchased skeins when they arrive, not when you merely mark them bought.</li><li>Update amounts after using thread on a project.</li><li>Check missing colors before shopping so you don't buy doubles.</li><li>Export a backup periodically; browser storage is not automatic cloud sync.</li></ol>
   <p>A collection export is useful for a spreadsheet. Use the full backup in Settings to preserve projects, preferences and stitching sessions as well as your collection. Keep the downloaded file somewhere you can find it.</p>
   <p>Ready to begin? <a href="index.html#threads">Open My Thread Collection</a> and choose the entry method that feels easiest.</p></section>'''
 },
 'cross-stitch-project-planning.html':{
   'title':'Cross-Stitch Project Planner & Checklist | Floss Fox',
   'description':'Plan a cross-stitch project step by step: read a pattern key, check floss inventory, calculate fabric size, build a shopping list and track progress.',
   'heading':'Plan your next cross-stitch project with Pip',
   'lede':'Starting a new design should feel exciting. These simple steps help you gather the supplies you need, make a realistic plan, and leave room to enjoy the stitching.',
   'body':'''<section class="card"><h2>1. Read the pattern key</h2><p>Find the thread brand, color numbers and any stated skein amounts. Check the stitch width and height, recommended fabric count, number of strands, and special instructions such as backstitch or blending. Stitch counts are not the same as skein quantities.</p>
   <p>Use <a href="index.html#convert">Find Floss</a> to review listed colors and <a href="floss-conversion-guide.html">learn about alternate brands</a> if necessary.</p></section>
   <section class="card"><h2>2. Check what you already own</h2><p>Compare the project colors against your <a href="index.html#threads">thread collection</a>. Make a note of partial skeins and uncertain counts. A color you own is not automatically enough to complete a large design.</p></section>
   <section class="card"><h2>3. Calculate the fabric to cut</h2><p>Use your pattern's stitch dimensions, fabric count and desired finishing margin. Aida and evenweave can work differently when stitching over one or over two fabric threads, so choose the correct setting before cutting. <a href="fabric.html">Pip's fabric calculator</a> will show the finished design and suggested cutting dimensions.</p></section>
   <section class="card"><h2>4. Make one shopping list</h2><p>In Shopping, choose “Take a combined shopping list” and select your projects. Floss Fox adds their requirements together and subtracts your confirmed collection once. Uncertain amounts stay under “Check first” so you can review them before buying.</p>
   <p>Use “Found” while walking the shop. It is a checklist mark: it does not mark a project purchase or add thread to your collection. Record purchases and received thread separately when appropriate.</p>
   <p>You can also share a list of thread codes and quantities. Shared links open for reading; importing creates a separate project only when the recipient chooses. A link can be forwarded and is not encrypted. Project notes, photos and journal entries are not included.</p></section>
   <section class="card"><h2>5. Leave yourself an easy return path</h2><p>Save where you stopped, even if it is just “finish the lower-left border.” Open the project's Stitching journal to record a date, stitches, minutes and notes. Any thread usage you record is a log, not an automatic deduction from your collection. Update your project percentage manually when it helps.</p>
   <p>Sessions and progress stay in this browser and are included in the full backup. Progress photos and short notes make a long project easier to return to. Pip can help you find the saved project again without insisting on daily streaks or deadlines.</p>
   <p>Finishing means more than a percentage: the stitched piece might become a gift, card, ornament, framed picture or keepsake. Your choice is the ending that matters.</p></section>'''
 }
}


def render_guide(filename, site='production'):
    assert filename in GUIDES
    assert site in ('production','dev')
    page=GUIDES[filename]
    url=BASE+filename
    title=escape(page['title'],quote=True)
    description=escape(page['description'],quote=True)
    canonical=f'<link rel="canonical" href="{url}">' if site=='production' else '<meta name="robots" content="noindex, nofollow">'
    og_url=f'<meta property="og:url" content="{url}">' if site=='production' else ''
    schema={"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","@id":url+"#page","url":url,"name":page['title'],"description":page['description'],"isPartOf":{"@id":BASE+"#website"}},
      {"@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Floss Fox","item":BASE},
        {"@type":"ListItem","position":2,"name":page['heading'],"item":url}
      ]}
    ]}
    jsonld=f'<script type="application/ld+json">{json.dumps(schema,ensure_ascii=False,separators=(",",":"))}</script>' if site=='production' else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{description}">
{canonical}
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article"><meta property="og:site_name" content="Floss Fox"><meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">{og_url}
<meta property="og:image" content="{BASE}og-image.png"><meta property="og:image:alt" content="Floss Fox, friendly cross-stitch companion">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{description}"><meta name="twitter:image" content="{BASE}og-image.png"><meta name="twitter:image:alt" content="Floss Fox, friendly cross-stitch companion">
{jsonld}<style>{STYLES}</style></head>
<body><div class="wrap"><header><img src="assets/pip/pip-greeting-160.png" width="65" height="65" alt="Pip, the Floss Fox mascot" decoding="async"><div><div class="brand">Floss Fox</div>
<nav class="nav" aria-label="Main"><a href="index.html">Open Floss Fox</a><a href="tools.html">Tools &amp; guides</a><a href="fabric.html">Fabric calculator</a><a href="about.html">About</a></nav></div></header>
<main id="content"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Floss Fox</a> / {escape(page['heading'])}</nav><p class="eyebrow">Free stitching guides</p>
<h1>{escape(page['heading'])}</h1><p class="lede">{escape(page['lede'])}</p>
{page['body']}
<section class="card cta"><h2>Ready when you are</h2><p>Bring your next stitching question to Floss Fox. Pip and your tools are waiting. There's no need to finish everything today.</p><a href="index.html">Open Floss Fox</a><a href="tools.html">Explore more tools</a></section></main>
<footer><a href="index.html">Home</a><a href="tools.html">Tools &amp; guides</a><a href="about.html">About</a><a href="privacy.html">Privacy</a><p class="muted">Floss Fox is an independent helper. Check physical thread colors and official product details before relying on a conversion.</p></footer></div></body></html>
'''
