module.exports = {
  globDirectory: 'dist/',

  globPatterns: [
    '**/*.{json,html,ico,png,js}'
  ],

  swDest: 'dist/sw.js',

  ignoreURLParametersMatching: [
    /^utm_/,
    /^fbclid$/
  ],

  navigateFallback: '/index.html',

  navigateFallbackDenylist: [
    /^\/_expo\//,
    /^\/assets\//,
    /^\/sw\.js$/,
    /^\/workbox-/
  ],

  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true
};