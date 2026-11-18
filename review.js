/* Leave a review (DEV PREVIEW). Opens a private Google Form in a new tab.
   Paste the live form URL into REVIEW_FORM_URL below. While that string is empty,
   the Leave a review buttons stay hidden so there is no broken link.
   Opening the form sends NOTHING from the app: no collection, projects, notes,
   journal or any localStorage value is put in the URL or posted anywhere.
   Optional app-version prefill is skipped (needs a form entry id once the form exists). */
(function () {
  'use strict';
  // Paste the Google Form viewform URL here (https only). Leave empty to hide the buttons.
  // Example: 'https://docs.google.com/forms/d/e/XXXX/viewform'
  const REVIEW_FORM_URL = '';

  const LABEL = 'Leave a review';
  const HINT = 'Tell us what you think. Your reply goes privately to the Floss Fox team. Nothing from your collection or projects is sent.';
  const ARIA = 'Leave a review (opens in a new tab)';

  function configuredUrl() {
    if (typeof window !== 'undefined' && typeof window.__FF_REVIEW_FORM_URL === 'string') {
      const o = window.__FF_REVIEW_FORM_URL.trim();
      if (/^https:\/\//i.test(o)) return o;
    }
    const t = typeof REVIEW_FORM_URL === 'string' ? REVIEW_FORM_URL.trim() : '';
    return /^https:\/\//i.test(t) ? t : '';
  }

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function makeBlock(id) {
    const url = configuredUrl();
    if (!url) return null;
    const wrap = el('div', 'ffreview');
    wrap.id = id;
    const row = el('div', 'row');
    const a = el('a', 'btnlink sec', LABEL);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', ARIA);
    row.appendChild(a);
    wrap.append(row, el('p', 'hint', HINT));
    return wrap;
  }

  function clearMounts() {
    ['ffReviewHelp', 'ffReviewSettings', 'ffReviewFooter'].forEach(function (id) {
      const n = document.getElementById(id);
      if (n) n.remove();
    });
  }

  function mount() {
    clearMounts();
    const url = configuredUrl();
    if (!url) return;

    const helpCard = document.querySelector('#helpView .card.help');
    if (helpCard) {
      const block = makeBlock('ffReviewHelp');
      if (block) {
        const aboutP = Array.prototype.find.call(helpCard.querySelectorAll(':scope > p'), function (p) {
          return p.querySelector('a[href="about.html"]');
        });
        if (aboutP) helpCard.insertBefore(block, aboutP);
        else helpCard.appendChild(block);
      }
    }

    const settingsCard = document.querySelector('#settingsView .card');
    if (settingsCard) {
      const block = makeBlock('ffReviewSettings');
      if (block) {
        block.insertBefore(el('h3', null, 'Feedback'), block.firstChild);
        settingsCard.appendChild(block);
      }
    }

    const foot = document.querySelector('footer .footlinks');
    if (foot) {
      const span = document.createElement('span');
      span.id = 'ffReviewFooter';
      span.appendChild(document.createTextNode(' · '));
      const a = el('a', null, LABEL);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', ARIA);
      span.appendChild(a);
      foot.appendChild(span);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  if (typeof window !== 'undefined') {
    window.FlossFoxReview = { mount: mount, url: configuredUrl, LABEL: LABEL, HINT: HINT };
  }
})();
