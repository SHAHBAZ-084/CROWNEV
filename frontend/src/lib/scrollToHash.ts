const HEADER_OFFSET = 96;

export function scrollToElementId(id: string, behavior: ScrollBehavior = 'smooth'): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}

export function scrollToHash(hash: string, maxAttempts = 30, intervalMs = 100): () => void {
  const id = hash.replace(/^#/, '');
  if (!id) return () => undefined;

  if (scrollToElementId(id)) return () => undefined;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (scrollToElementId(id) || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, intervalMs);

  return () => window.clearInterval(timer);
}
