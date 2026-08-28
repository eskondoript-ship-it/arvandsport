/** Entry point: boot the chrome once, page modules on every container swap. */
import { ready } from './env.js';
import { initMotion, teardownMotion, watchMotionPreference } from './motion.js';
import { initHeader, syncChrome } from './header.js';
import { initTheme } from './theme.js';
import { initRoster, initNewsSearch } from './roster.js';
import { initForms } from './forms.js';
import { initEmbeds } from './embed.js';
import { initWire } from './wire.js';
import { initDossier } from './dossier.js';
import { initApex } from './apex.js';
import { initCursor, destroyCursor } from './cursor.js';
import { initTransitions } from './transitions.js';

function initPage(container = document) {
  initRoster(container);
  initNewsSearch(container);
  initForms(container);
  initEmbeds(container);
  initWire(container);
  initDossier(container);
  initApex(container);
  initMotion(container);
}

ready(() => {
  initHeader();
  initTheme();
  watchMotionPreference(destroyCursor);
  initCursor();
  initPage();

  initTransitions((container, pathname, doc) => {
    teardownMotion();
    syncChrome(doc, pathname);
    initPage(container);
  });
});
