import React, { useEffect, useState } from 'react';
import { SheetRecord, GrandTotals } from '../types';
import { generateRecordQrDataUrl, buildRecordAuditPayload } from '../utils/qrCode';
import { QrCode, CheckCircle2 } from 'lucide-react';

interface RecordAuditQrCodeProps {
  record: SheetRecord;
  totals: GrandTotals;
  className?: string;
  size?: number;
  showCaption?: boolean;
}

export const RecordAuditQrCode: React.FC<RecordAuditQrCodeProps> = ({
  record,
  totals,
  className = '',
  size = 120,
  showCaption = true,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    generateRecordQrDataUrl(record, totals, size * 2).then((url) => {
      if (isMounted) {
        setQrUrl(url);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [record, totals, size]);

  const handleCopyPayload = () => {
    const payload = buildRecordAuditPayload(record, totals);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!qrUrl) {
    return (
      <div className={`flex items-center justify-center border border-dashed border-zinc-300 p-2 ${className}`}>
        <QrCode className="w-6 h-6 text-zinc-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center bg-white border border-black p-1.5 shadow-xs ${className}`}
      title="Scan with a mobile camera or barcode scanner for digital audit verification"
    >
      <img
        src={qrUrl}
        alt={`Audit QR Code for record ${record.id}`}
        className="object-contain block"
        style={{ width: `${size}px`, height: `${size}px` }}
        referrerPolicy="no-referrer"
      />
      {showCaption && (
        <div className="mt-1 text-center">
          <div className="text-[8px] font-mono font-bold tracking-tight text-black uppercase leading-tight">
            ID: {record.id.slice(0, 10)}...
          </div>
          <button
            type="button"
            onClick={handleCopyPayload}
            className="text-[8px] font-bold text-zinc-500 hover:text-black uppercase tracking-wider print:hidden cursor-pointer mt-0.5 inline-flex items-center gap-0.5"
            title="Copy audit payload text to clipboard"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <span>Digital Verify</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
