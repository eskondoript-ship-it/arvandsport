/** Entry point: boot the chrome once, page modules on every container swap. */
import { ready } from './env.js';
import { initMotion, teardownMotion, watchMotionPreference } from './motion.js';
import { initHeader, syncChrome } from './header.js';
import { initRoster, initNewsSearch } from './roster.js';
import { initForms } from './forms.js';
import { initTransitions } from './transitions.js';

function initPage(container = document) {
  initRoster(container);
  initNewsSearch(container);
  initForms(container);
  initMotion(container);
}

ready(() => {
  initHeader();
  watchMotionPreference();
  initPage();

  initTransitions((container, pathname, doc) => {
    teardownMotion();
    syncChrome(doc, pathname);
    initPage(container);
  });
});
