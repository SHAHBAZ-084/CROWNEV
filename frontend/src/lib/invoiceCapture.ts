import html2canvas from 'html2canvas-pro';
import { SITE_LOGO } from './placeholders';

const CAPTURE_WIDTH = 800;

/** Theme tokens used on invoice print layouts — copied onto the capture host so html2canvas resolves Tailwind CSS variables. */
const THEME_CSS_VARS = [
  'color-brand',
  'color-brand-light',
  'color-accent',
  'color-accent-hover',
  'color-accent-soft',
  'color-surface',
  'color-surface-alt',
  'color-success',
  'color-warning',
  'color-text',
  'color-text-muted',
  'color-border',
  'font-display',
  'font-body',
] as const;

function copyThemeVars(target: HTMLElement) {
  const root = getComputedStyle(document.documentElement);
  for (const name of THEME_CSS_VARS) {
    const value = root.getPropertyValue(`--${name}`).trim();
    if (value) target.style.setProperty(`--${name}`, value);
  }
  target.style.fontFamily = root.fontFamily;
  target.style.color = root.getPropertyValue('--color-text').trim() || '#1a1a1a';
  target.style.background = '#ffffff';
}

function absoluteUrl(src: string): string {
  return new URL(src, window.location.origin).href;
}

/** html2canvas-pro ignores &lt;picture&gt; — replace with a plain absolute-URL &lt;img&gt;. */
function prepareImagesForCapture(root: HTMLElement) {
  root.querySelectorAll('picture').forEach((picture) => {
    const img = picture.querySelector('img');
    const replacement = document.createElement('img');
    const logoUrl = absoluteUrl(img?.getAttribute('src') || SITE_LOGO.src);
    replacement.src = logoUrl;
    replacement.alt = img?.alt || SITE_LOGO.alt;
    if (img) {
      replacement.className = img.className;
      replacement.style.cssText = img.style.cssText;
      if (img.width) replacement.width = img.width;
      if (img.height) replacement.height = img.height;
    }
    replacement.setAttribute('decoding', 'sync');
    picture.replaceWith(replacement);
  });

  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    try {
      img.src = absoluteUrl(src);
    } catch {
      /* keep original */
    }
  });
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
          if (!img.complete) {
            const current = img.src;
            img.src = '';
            img.src = current;
          } else {
            resolve();
          }
        }),
    ),
  );
}

function prepareCloneForCapture(source: HTMLElement, clone: HTMLElement) {
  const fullHeight = Math.max(source.scrollHeight, source.offsetHeight);

  clone.style.boxShadow = 'none';
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.maxWidth = `${CAPTURE_WIDTH}px`;
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.position = 'relative';
  clone.style.minHeight = `${fullHeight}px`;

  prepareImagesForCapture(clone);
}

export async function captureInvoiceElement(source: HTMLElement): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${CAPTURE_WIDTH}px`,
    'background:#fff',
    'z-index:-1',
    'overflow:visible',
  ].join(';');
  copyThemeVars(host);

  const clone = source.cloneNode(true) as HTMLElement;
  prepareCloneForCapture(source, clone);
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const captureHeight = Math.max(
      source.scrollHeight,
      clone.scrollHeight,
      clone.offsetHeight,
      100,
    );

    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: CAPTURE_WIDTH,
      height: captureHeight,
      windowWidth: CAPTURE_WIDTH,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
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
  win.document.open();
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

  const triggerPrint = () => {
    win.focus();
    win.print();
  };
  setTimeout(triggerPrint, 400);
}

/** Split a tall canvas across multiple A4 pages instead of clipping to one page. */
export async function saveCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/png');
  const imgHeightMm = (canvas.height * pageW) / canvas.width;

  let heightLeft = imgHeightMm;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageW, imgHeightMm);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position = heightLeft - imgHeightMm;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgHeightMm);
    heightLeft -= pageH;
  }

  pdf.save(filename);
}
