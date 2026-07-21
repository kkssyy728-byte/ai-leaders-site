(function (global) {
  'use strict';

  var SUPABASE_HOST = 'wdghlbswlvwlmkywiibr.supabase.co';
  var PATH_OVERRIDES = Object.freeze({
    '/storage/v1/object/public/instructor-portfolio/hero/2026/07/file-mrctrjml-wjb3nkev.jpg': '/images/managed/home-hero-file-mrctrjml-wjb3nkev.webp',
    '/storage/v1/object/public/instructor-portfolio/hero/2026/07/file-mru5xv6t-7ezfoy2j.jpg': '/images/managed/home-hero-file-mru5xv6t-7ezfoy2j.webp',
    '/storage/v1/object/public/site-assets/hero/2026/07/file-mru7t4pu-978044sn.jpg': '/images/managed/home-hero-file-mru7t4pu-978044sn.webp',
    '/storage/v1/object/public/site-assets/hero/2026/07/file-mru9rcs1-ftxh78dx.jpg': '/images/managed/home-hero-file-mru9rcs1-ftxh78dx.webp',
    '/storage/v1/object/public/site-assets/hero/2026/07/file-mrua0xpl-tur7dmwm.jpg': '/images/managed/home-hero-file-mrua0xpl-tur7dmwm.webp'
  });

  function resolve(value) {
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';

    try {
      var url = new URL(raw, global.location.origin);
      if (url.hostname !== SUPABASE_HOST) return raw;
      return PATH_OVERRIDES[url.pathname] || raw;
    } catch (error) {
      return raw;
    }
  }

  global.AiLeadersPublicMedia = {
    resolve: resolve
  };
})(window);
