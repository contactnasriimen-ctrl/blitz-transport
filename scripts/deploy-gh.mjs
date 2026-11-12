// Builds the GitHub Pages preview into dist-gh/ and pushes it to the gh-pages branch.
// Usage: npm run deploy
import { build } from 'vite';
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync, existsSync } from 'node:fs';

const REPO = 'contactnasriimen-ctrl/blitz-transport';
const NAME = REPO.split('/')[1];
process.env.BASE = `/${NAME}/`;
process.env.PREVIEW = '1';
process.env.SITE_URL = `https://${REPO.split('/')[0]}.github.io/${NAME}`;

await build({ build: { outDir: 'dist-gh', emptyOutDir: true } });
if (existsSync('dist-gh/.htaccess')) rmSync('dist-gh/.htaccess');
writeFileSync('dist-gh/.nojekyll', '');

const run = (cmd) => execSync(cmd, { cwd: 'dist-gh', stdio: 'inherit' });
rmSync('dist-gh/.git', { recursive: true, force: true });
run('git init -q -b gh-pages');
run('git add -A');
run(`git commit -q -m "Deploy ${new Date().toISOString().slice(0, 16).replace('T', ' ')}"`);
run(`git push -q --force https://github.com/${REPO}.git gh-pages`);
console.log(`\nLive in ~1 min: ${process.env.SITE_URL}/`);
