// Resizes scripts/icon-master.png into the home-screen and Android icons.
// The browser-tab image is public/icons/favicon-32.png and is left as drawn.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('python3', [join(root, 'scripts/resize-icons.py')], { stdio: 'inherit', cwd: root });
