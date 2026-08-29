/** Entry point: boot the chrome once, page modules on every container swap. */
import { ready } from './env.js';
import { initMotion, teardownMotion, watchMotionPreference } from './motion.js';
import { initHeader, syncChrome } from './header.js';
import { initTheme } from './theme.js';
import { initSmoothScroll, destroySmoothScroll } from './smooth.js';
import { initRoster, initNewsSearch } from './roster.js';
import { initCarousel } from './carousel.js';
import { initForms } from './forms.js';
import { initEmbeds } from './embed.js';
import { initWire } from './wire.js';
import { initDossier } from './dossier.js';
import { initApex } from './apex.js';
import { initCursor, destroyCursor } from './cursor.js';
import { initTransitions } from './transitions.js';

function initPage(container = document) {
  initRoster(container);
  initCarousel(container);
  initNewsSearch(container);
  initForms(container);
  initEmbeds(container);
  initWire(container);
  initDossier(container);
  initApex(container);
  initMotion(container);
}

ready(() => {
  /* Before the motion system: ScrollTrigger reads the scroll position
   * through Lenis once it is running, so it has to exist first. */
  initSmoothScroll();
  initHeader();
  initTheme();
  watchMotionPreference(() => {
    destroyCursor();
    destroySmoothScroll();
  });
  initCursor();
  initPage();

  initTransitions((container, pathname, doc) => {
    teardownMotion();
    syncChrome(doc, pathname);
    initPage(container);
  });
});
