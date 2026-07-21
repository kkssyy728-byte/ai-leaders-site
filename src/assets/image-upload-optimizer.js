(function (global) {
  'use strict';

  var DEFAULT_OPTIONS = Object.freeze({
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.78,
    mimeType: 'image/webp'
  });

  function isCompressibleImage(file) {
    if (!file || !/^image\//i.test(file.type || '')) return false;
    return !/image\/(?:gif|svg\+xml)/i.test(file.type || '');
  }

  function extensionForType(type) {
    if (type === 'image/webp') return '.webp';
    if (type === 'image/png') return '.png';
    return '.jpg';
  }

  function stem(name) {
    return String(name || 'image').replace(/\.[^.]+$/, '') || 'image';
  }

  function formatBytes(value) {
    var bytes = Number(value) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function optimize(file, overrides) {
    if (!isCompressibleImage(file) || typeof global.Compressor !== 'function') {
      return Promise.resolve({ file: file, changed: false, beforeBytes: file ? file.size : 0, afterBytes: file ? file.size : 0 });
    }

    var options = Object.assign({}, DEFAULT_OPTIONS, overrides || {});
    return new Promise(function (resolve, reject) {
      new global.Compressor(file, {
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        quality: options.quality,
        mimeType: options.mimeType,
        retainExif: false,
        success: function (result) {
          var resultType = result.type || file.type || 'image/jpeg';
          var converted = new global.File(
            [result],
            stem(file.name) + extensionForType(resultType),
            { type: resultType, lastModified: file.lastModified || Date.now() }
          );
          var useConverted = converted.size < file.size;
          var output = useConverted ? converted : file;
          resolve({
            file: output,
            changed: useConverted,
            beforeBytes: file.size,
            afterBytes: output.size
          });
        },
        error: reject
      });
    });
  }

  global.AiLeadersImageOptimizer = {
    optimize: optimize,
    formatBytes: formatBytes
  };
})(window);
