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
  // Use the real body font stack (Inter) — reading getComputedStyle(<html>).fontFamily
  // here previously grabbed the *unset* font on the <html> element itself, which
  // browsers resolve to a default serif face, not the Inter font the page actually
  // renders with. That mismatch was the cause of the rough-looking PDF/print font.
  const bodyFont = getComputedStyle(document.body).fontFamily;
  target.style.fontFamily = bodyFont || root.getPropertyValue('--font-body').trim() || 'Inter, sans-serif';
  target.style.color = '#334155';
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

function prepareCloneForCapture(clone: HTMLElement) {
  clone.style.boxShadow = 'none';
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.maxWidth = `${CAPTURE_WIDTH}px`;
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.style.overflow = 'visible';
  clone.style.position = 'relative';
  clone.style.margin = '0';

  prepareImagesForCapture(clone);
}

/** Crop empty margins from html2canvas output so PDF pages match content size. */
function trimCanvasWhitespace(canvas: HTMLCanvasElement, paddingPx = 8): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 8) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 250 && g > 250 && b > 250) continue;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right <= left || bottom <= top) return canvas;

  left = Math.max(0, left - paddingPx);
  top = Math.max(0, top - paddingPx);
  right = Math.min(width - 1, right + paddingPx);
  bottom = Math.min(height - 1, bottom + paddingPx);

  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  cropped.getContext('2d')!.drawImage(
    canvas,
    left,
    top,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );
  return cropped;
}

export async function captureInvoiceElement(source: HTMLElement): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'opacity:0',
    'pointer-events:none',
    `width:${CAPTURE_WIDTH}px`,
    'background:#fff',
    'z-index:-1',
    'overflow:visible',
  ].join(';');
  copyThemeVars(host);

  const clone = source.cloneNode(true) as HTMLElement;
  prepareCloneForCapture(clone);
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // Lock the viewport width to CAPTURE_WIDTH to prevent media query wrapping 
    // and clipping when the user's browser window is narrow.
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: CAPTURE_WIDTH,
      windowWidth: CAPTURE_WIDTH,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Failed to capture invoice content');
    }

    return trimCanvasWhitespace(canvas);
  } finally {
    host.remove();
  }
}

export function openPrintWindow(canvas: HTMLCanvasElement, title: string) {
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'noopener,noreferrer,width=950,height=800');
  if (!win) {
    throw new Error('Please allow pop-ups to print or save the invoice');
  }

  // Pick whichever A5 half-page orientation lets the invoice render largest,
  // matching the same heuristic used for the PDF export.
  const canvasRatio = canvas.width / canvas.height;
  const portraitRatio = 148 / 210;
  const landscapeRatio = 210 / 148;
  const isLandscape =
    Math.abs(Math.log(canvasRatio / landscapeRatio)) < Math.abs(Math.log(canvasRatio / portraitRatio));
  const pageSizeRule = isLandscape ? 'A5 landscape' : 'A5 portrait';

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${pageSizeRule}; margin: 8mm; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; padding: 20px; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); background: #ffffff; }
  @media print {
    body { background: transparent; padding: 0; display: block; min-height: 0; }
    img { box-shadow: none; max-width: 100%; max-height: 100%; width: 100%; height: auto; }
  }
</style></head>
<body><img src="${dataUrl}" alt="Invoice" /></body></html>`);
  win.document.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
  };
  setTimeout(triggerPrint, 400);
}

/**
 * Export invoice canvas onto a true half-A4 (A5) PDF page.
 * Picks whichever A5 orientation (portrait 148x210mm or landscape 210x148mm)
 * lets the invoice render largest without ever exceeding the page bounds,
 * then top-aligns it with a small margin so it always looks like a proper
 * compact half-page invoice regardless of how many line items it has.
 */
export async function saveCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const { default: jsPDF } = await import('jspdf');
  if (!canvas.width || !canvas.height) {
    throw new Error('Invoice capture is empty');
  }

  const A5_PORTRAIT = { w: 148, h: 210 } as const;
  const A5_LANDSCAPE = { w: 210, h: 148 } as const;
  const margin = 6; // mm

  const canvasRatio = canvas.width / canvas.height;

  function fitToPage(page: { w: number; h: number }) {
    const printableW = page.w - margin * 2;
    const printableH = page.h - margin * 2;
    const printableRatio = printableW / printableH;

    let imgW: number;
    let imgH: number;
    if (canvasRatio > printableRatio) {
      imgW = printableW;
      imgH = printableW / canvasRatio;
    } else {
      imgH = printableH;
      imgW = printableH * canvasRatio;
    }
    return { imgW, imgH, area: imgW * imgH };
  }

  const portraitFit = fitToPage(A5_PORTRAIT);
  const landscapeFit = fitToPage(A5_LANDSCAPE);
  const useLandscape = landscapeFit.area > portraitFit.area;

  const page = useLandscape ? A5_LANDSCAPE : A5_PORTRAIT;
  const { imgW, imgH } = useLandscape ? landscapeFit : portraitFit;

  // Center horizontally, top-align vertically (natural document flow —
  // header sits just under the margin instead of floating mid-page).
  const x = (page.w - imgW) / 2;
  const y = margin;

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF(useLandscape ? 'l' : 'p', 'mm', 'a5');
  pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');
  pdf.save(filename);
}
