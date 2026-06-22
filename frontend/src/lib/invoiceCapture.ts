import html2canvas from 'html2canvas-pro';

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  );
}

export async function captureInvoiceElement(source: HTMLElement): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;z-index:-1';
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = 'none';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800,
      logging: false,
    });
  } finally {
    host.remove();
  }
}

export function openPrintWindow(canvas: HTMLCanvasElement, title: string) {
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!win) {
    throw new Error('Please allow pop-ups to print or save the invoice');
  }
  win.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; padding: 16px; }
  img { width: 100%; max-width: 800px; height: auto; }
  @media print { body { padding: 0; } img { max-width: 100%; } }
</style></head>
<body><img src="${dataUrl}" alt="Invoice" /></body></html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
