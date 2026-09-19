/**
 * Print Helper Utility
 * Provides cross-browser, iframe-resilient printing and PDF generation support.
 */

/**
 * Triggers a browser print dialog by creating a clean, hidden same-origin iframe.
 * If running inside a sandboxed iframe that blocks direct printing, this catches
 * the restriction and returns false so the caller can trigger a fallback.
 */
export function triggerBrowserPrint(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Remove any existing print frame
      const oldFrame = document.getElementById('global-print-frame');
      if (oldFrame && oldFrame.parentNode) {
        oldFrame.parentNode.removeChild(oldFrame);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'global-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        try {
          window.print();
          resolve(true);
        } catch {
          resolve(false);
        }
        return;
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print failed or was blocked by browser sandbox:', err);
          try {
            window.print();
            resolve(true);
          } catch {
            resolve(false);
          }
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 350);
    } catch (err) {
      console.warn('triggerBrowserPrint error:', err);
      resolve(false);
    }
  });
}

/**
 * Opens a printable HTML document in a fresh browser tab via a trusted user click.
 * In a new tab, the document is outside any sandbox, so native window.print() works without restrictions.
 */
export function openPrintableTab(html: string): void {
  let printableHtml = html;
  // Inject auto-print script if not already present
  if (!printableHtml.includes('window.print()')) {
    printableHtml = printableHtml.replace(
      '</body>',
      `<script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            try { window.print(); } catch(e) {}
          }, 400);
        });
      </script></body>`
    );
  }

  const blob = new Blob([printableHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}
