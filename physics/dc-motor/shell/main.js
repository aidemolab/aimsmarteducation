// Entry point: boots the shell for every explainer root on the page.
import { bootShell } from './shell.js';

for (const root of document.querySelectorAll('.aim-app[data-scene]')) {
  bootShell(root);
}
