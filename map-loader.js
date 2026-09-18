(() => {
  'use strict';
  const cssCandidates = [
    '/api/vendor/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
  ];
  const jsCandidates = [
    '/api/vendor/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
  ];

  function addCss(url) {
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      let done=false; const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};
      const timer=setTimeout(()=>{link.remove();finish(false);},2200);
      link.onload = () => finish(true);
      link.onerror = () => { link.remove(); finish(false); };
      document.head.appendChild(link);
    });
  }

  async function ensureCss() {
    for (const url of cssCandidates) {
      if (await addCss(url)) return true;
    }
    return false;
  }

  function addScript(url) {
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      let done=false; const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};
      const timer=setTimeout(()=>{script.remove();finish(false);},2800);
      script.onload = () => finish(!!window.L);
      script.onerror = () => { script.remove(); finish(false); };
      document.head.appendChild(script);
    });
  }

  async function loadLeaflet() {
    if (window.L) return true;
    ensureCss();
    for (const url of jsCandidates) {
      if (await addScript(url)) return true;
    }
    return false;
  }

  window.HIMGAURAV_MAP_READY = loadLeaflet();
})();
