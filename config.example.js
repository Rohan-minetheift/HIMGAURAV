/* HIMGAURAV browser-side configuration template.
   Copy to config.js and edit only non-secret defaults.
   Private ThingSpeak keys, BHASHINI keys and webhook tokens belong in .env. */
window.HIMGAURAV_CONFIG = {
  // Optional public ThingSpeak defaults. Never put WRITE keys here.
  thingSpeak: {
    channelId: "",
    siteId: "kotrupi",
    tiltField: 1,
    moistureField: 0,
    rainField: 0,
    batteryField: 0,
    rssiField: 0
  },

  // Copernicus Data Space / Sentinel Hub requires OAuth2. Do not place a client
  // secret in a browser build. Use a backend token/tile proxy when implemented.
  copernicus: {
    enabled: false,
    proxyUrl: ""
  },

  // Optional production basemap. Keep {z}/{x}/{y} placeholders.
  basemap: {
    tileUrl: "",
    attribution: ""
  }
};
