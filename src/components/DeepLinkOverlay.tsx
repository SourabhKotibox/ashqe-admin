import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

export function DeepLinkOverlay({ contentId, contentType }: { contentId: string; contentType: 'movie' | 'webseries' }) {
  const [show, setShow] = useState(false);
  const [intentUrl, setIntentUrl] = useState('');
  const [iosUrl, setIosUrl] = useState('');

  useEffect(() => {
    if (!contentId) return;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

    if (isAndroid) {
      const playStoreUrl = `https://play.google.com/store/apps/details?id=com.ashqe.tophills&referrer=movie_id%3D${contentId}`;
      const url = `intent://${contentType}/${contentId}#Intent;scheme=ashqe;package=com.ashqe.tophills;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
      setIntentUrl(url);
      setShow(true);
      
      // Attempt auto-redirect once more from React
      setTimeout(() => {
        window.location.href = url;
      }, 500);
      
    } else if (isIOS) {
      const url = `ashqe://${contentType}/${contentId}`;
      setIosUrl(url);
      setShow(true);
      
      // Attempt auto-redirect once more from React
      setTimeout(() => {
        window.location.href = url;
        setTimeout(() => {
          window.location.href = 'https://apps.apple.com/app/id123456789';
        }, 2500);
      }, 500);
    }
  }, [contentId, contentType]);

  if (!show) return null;

  const handleOpenApp = () => {
    if (intentUrl) window.location.href = intentUrl;
    if (iosUrl) {
      window.location.href = iosUrl;
      setTimeout(() => {
        window.location.href = 'https://apps.apple.com/app/id123456789';
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
      <Smartphone className="w-20 h-20 text-[#ff0055] mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(255,0,85,0.5)]" />
      <h2 className="text-3xl font-bold text-white mb-3">Open Ashqe App</h2>
      <p className="text-zinc-300 mb-10 max-w-xs text-lg">
        To watch this content, please continue in our mobile application.
      </p>
      <button 
        onClick={handleOpenApp}
        className="w-full max-w-[280px] bg-[#ff0055] hover:bg-[#ff0055]/90 text-white font-bold py-5 px-8 rounded-full text-xl transition-all shadow-[0_0_30px_rgba(255,0,85,0.4)] active:scale-95"
      >
        Open App Now
      </button>
      
      <button onClick={() => setShow(false)} className="mt-8 text-zinc-500 hover:text-zinc-400 underline text-sm transition-colors">
        Continue on website anyway
      </button>
    </div>
  );
}
