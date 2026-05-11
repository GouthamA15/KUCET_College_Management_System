export function smoothScrollToTop(options = {}) {
  if (typeof window === 'undefined') return;

  const behavior = options?.behavior || 'smooth';

  try {
    window.scrollTo({ top: 0, behavior });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {
      // ignore
    }
  }
}

export function smoothScrollToElement(el, options = {}) {
  if (typeof window === 'undefined') return;

  const behavior = options?.behavior || 'smooth';
  const block = options?.block || 'start';
  const inline = options?.inline || 'nearest';

  if (!el) {
    smoothScrollToTop({ behavior });
    return;
  }

  try {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior, block, inline });
    } else {
      smoothScrollToTop({ behavior });
    }
  } catch {
    smoothScrollToTop({ behavior });
  }
}

export function smoothScrollToId(id, options = {}) {
  if (typeof document === 'undefined') return;
  smoothScrollToElement(document.getElementById(id), options);
}

export function smoothScrollToRef(ref, options = {}) {
  smoothScrollToElement(ref?.current || null, options);
}
