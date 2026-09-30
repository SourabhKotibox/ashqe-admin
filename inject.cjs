const fs = require('fs');
const path = 'ashqe-admin/index.html';
let html = fs.readFileSync(path, 'utf8');

const script = `
    <!-- SMART APP BANNER / REDIRECT -->
    <script>
      (function() {
        try {
          var path = window.location.pathname;
          var parts = path.split('/').filter(Boolean);
          if (parts.length >= 2 && (parts[0] === 'movie' || parts[0] === 'webseries' || parts[0] === 'show')) {
            var contentType = parts[0] === 'show' ? 'webseries' : parts[0];
            var contentId = parts[1];
            var userAgent = navigator.userAgent || navigator.vendor || window.opera;
            
            if (/android/i.test(userAgent)) {
              var playStoreUrl = "https://play.google.com/store/apps/details?id=com.ashqe.tophills&referrer=movie_id%3D" + contentId;
              var intentUrl = "intent://" + contentType + "/" + contentId + "#Intent;scheme=ashqe;package=com.ashqe.tophills;S.browser_fallback_url=" + encodeURIComponent(playStoreUrl) + ";end";
              window.location.replace(intentUrl);
            } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
              var iosScheme = "ashqe://" + contentType + "/" + contentId;
              window.location.replace(iosScheme);
              setTimeout(function() {
                window.location.replace("https://apps.apple.com/app/id123456789");
              }, 2500);
            }
          }
        } catch(e) {}
      })();
    </script>
`;

if (!html.includes('SMART APP BANNER')) {
  html = html.replace('</head>', script + '  </head>');
  fs.writeFileSync(path, html);
  console.log("Injected script");
}
