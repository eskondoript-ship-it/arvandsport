/**
 * Click-to-load video embeds.
 *
 * The page ships a poster and a button, not an iframe. YouTube is only
 * contacted once a visitor actually asks for the clip, which keeps third-party
 * cookies and ~1MB of player script off the initial load, and means the
 * embed costs nothing to the visitors who never press play.
 *
 * The clip is served by the rights holder's own player rather than rehosted.
 */
import { $$ } from './env.js';

const SRC = {
  youtube: (id) =>
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
};

export function initEmbeds(root = document) {
  for (const facade of $$('[data-embed]', root)) {
    if (facade.dataset.embedReady) continue;
    facade.dataset.embedReady = '1';

    facade.addEventListener('click', () => {
      const build = SRC[facade.dataset.embedProvider];
      const id = facade.dataset.embedId;
      if (!build || !id) return;

      const frame = document.createElement('iframe');
      frame.src = build(id);
      frame.title = facade.dataset.embedTitle || 'Video';
      frame.loading = 'lazy';
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      frame.className = 'embed__frame';

      facade.replaceWith(frame);
    }, { once: true });
  }
}
