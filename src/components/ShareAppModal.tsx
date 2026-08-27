import React, { useState } from 'react';
import { Smartphone, Copy, Check, Share2, X, ExternalLink, QrCode } from 'lucide-react';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  // Get the current active URL dynamically
  const appUrl = typeof window !== 'undefined' && window.location.href
    ? window.location.href.split('#')[0].split('?')[0]
    : 'https://ais-dev-qiydrm3ywapsn4te4if2z5-503805516935.europe-west1.run.app';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Daily Till Cashing Up Sheet',
          text: 'Open the Daily Till Cashing Up Sheet App on your phone',
          url: appUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white text-black border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-black text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif italic font-bold text-lg">Android & Mobile App Link</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Direct Link Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              Direct Application URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 bg-zinc-100 border-2 border-black px-3 py-2 text-xs font-mono select-all rounded font-bold text-zinc-900 overflow-hidden text-ellipsis"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs uppercase tracking-wider px-3 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer shrink-0 active:translate-x-0.5 active:translate-y-0.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-3 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-amber-400" />
              Share / Send Link
            </button>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 text-black font-bold text-xs uppercase tracking-wider py-2.5 px-3 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-center"
            >
              <ExternalLink className="w-4 h-4" />
              Open New Tab
            </a>
          </div>

          {/* QR Code Section */}
          <div className="bg-zinc-50 border-2 border-black p-4 rounded-lg flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black mb-2">
              <QrCode className="w-4 h-4 text-amber-600" />
              Scan with Phone Camera
            </div>
            <div className="bg-white p-2 border border-zinc-300 rounded shadow-xs mb-2">
              <img
                src={qrImageUrl}
                alt="App QR Code"
                className="w-36 h-36 object-contain"
                loading="lazy"
              />
            </div>
            <p className="text-[11px] text-zinc-600 font-medium max-w-xs">
              Point your Android phone camera at this QR code to instantly open the app on your device.
            </p>
          </div>

          {/* How to Install on Android */}
          <div className="border-t-2 border-zinc-200 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              How to Install on Android Phone:
            </h3>
            <ol className="text-xs text-zinc-700 space-y-1.5 list-decimal list-inside font-medium bg-amber-50/80 p-3 rounded border border-amber-200">
              <li>Open the copied link in <strong>Chrome on your Android phone</strong>.</li>
              <li>Tap the <strong>three dots (⋮)</strong> menu in the top right corner of Chrome.</li>
              <li>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</li>
              <li>The Daily Till Cashing Up icon will appear on your phone home screen as a full app!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 px-5 py-3 border-t-2 border-black flex justify-end">
          <button
            onClick={onClose}
            className="bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
