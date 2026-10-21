/* Cookie-free visit counts with GoatCounter. Loads ONLY on flossfox.com and www.flossfox.com:
   on the dev preview, localhost or any other host nothing is loaded and nothing is sent.
   Sends only GoatCounter's page-view data (page path, referrer, screen size, browser). Never projects, threads or files.
   GC_CODE is the one place to set the GoatCounter site code (the production build script replaces it). */
(function(){'use strict';
 var GC_CODE='flossfox';
 var HOSTS=['flossfox.com','www.flossfox.com'];
 if(HOSTS.indexOf(String(location.hostname).toLowerCase())<0)return;
 var s=document.createElement('script');s.async=true;s.src='https://gc.zgo.at/count.js';
 s.setAttribute('data-goatcounter','https://'+GC_CODE+'.goatcounter.com/count');
 (document.head||document.documentElement).appendChild(s);
})();
