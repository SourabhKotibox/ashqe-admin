import { useEffect } from 'react';

export function useDeepLinkRedirect(contentId: string, contentType: 'movie' | 'webseries') {
  useEffect(() => {
    if (!contentId) return;

    // Detect if the user is on mobile
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

    // We only want to redirect automatically if they are on a mobile browser.
    // If they are on a Desktop, they should stay on the website!
    if (isAndroid) {
      const playStoreUrl = `https://play.google.com/store/apps/details?id=com.ashqe.tophills&referrer=movie_id%3D${contentId}`;
      const androidIntent = `intent://${contentType}/${contentId}#Intent;scheme=ashqe;package=com.ashqe.tophills;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
      window.location.href = androidIntent;
    } else if (isIOS) {
      const iosScheme = `ashqe://${contentType}/${contentId}`;
      window.location.href = iosScheme;
      
      // Fallback to App Store if the app is not installed
      setTimeout(() => {
        window.location.href = 'https://apps.apple.com/app/id123456789';
      }, 2500);
    }
  }, [contentId, contentType]);
}
