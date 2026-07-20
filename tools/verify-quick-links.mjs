import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'src/pages/index.html',
  'src/pages/company/about.html',
  'src/pages/company/faq.html',
  'src/pages/company/instructor.html',
  'src/pages/company/reviews.html',
  'src/pages/courses/corporate.html',
  'src/pages/courses/detail.html',
  'src/pages/courses/free.html',
  'src/pages/courses/paid.html',
  'src/pages/forms/corporate.html',
  'src/pages/forms/instructor-apply.html',
];

const errors = [];

function count(text, fragment) {
  return text.split(fragment).length - 1;
}

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  if (count(html, 'data-site-quick-links') !== 1) errors.push(`${page}: quick-links mount must appear once`);
  if (count(html, '/assets/quick-links.js') !== 1) errors.push(`${page}: quick-links script must appear once`);
  if (/class=["']quick-bar["']|querySelector\(["']\.quick-bar|\.quick-bar\s*\{/.test(html)) {
    errors.push(`${page}: retired inline quick-bar implementation remains`);
  }
}

const applicationComplete = await readFile(path.join(root, 'src/pages/forms/application-complete.html'), 'utf8');
if (applicationComplete.includes('data-site-quick-links') || applicationComplete.includes('/assets/quick-links.js')) {
  errors.push('src/pages/forms/application-complete.html: quick links should remain omitted');
}

const component = await readFile(path.join(root, 'src/assets/quick-links.js'), 'utf8');
const expectedLinks = [
  'https://www.instagram.com/ai_leaders_/',
  'https://www.facebook.com/people/Ai%EB%A6%AC%EB%8D%94%EC%8A%A4%ED%98%91%ED%9A%8C/61567872351191/#',
  'href="#"',
  'https://www.youtube.com/@AI%EB%A6%AC%EB%8D%94%EC%8A%A4%ED%98%91%ED%9A%8C',
  'https://cafe.naver.com/newaileaders',
];
let previousIndex = -1;
for (const expected of expectedLinks) {
  const index = component.indexOf(expected, previousIndex + 1);
  if (index === -1) errors.push(`src/assets/quick-links.js: missing ${expected}`);
  else if (index <= previousIndex) errors.push(`src/assets/quick-links.js: incorrect social link order near ${expected}`);
  previousIndex = index;
}
if (count(component, 'class=\"qitem\"') !== 5) errors.push('src/assets/quick-links.js: expected exactly five social items');
if (!component.includes('class=\"q-top\"')) errors.push('src/assets/quick-links.js: missing TOP button');
if (!component.includes('class=\"q-naver-mark\"') || !component.includes('fill=\"currentColor\"') || !component.includes('fill=\"#ffffff\"')) {
  errors.push('src/assets/quick-links.js: missing tone-matched monochrome Naver Cafe icon');
}
if (!component.includes('transform=\"translate(6.666667 6.666667) scale(.4444444)\"')) {
  errors.push('src/assets/quick-links.js: Naver mark must remain at two-thirds of its previous size');
}

const styles = await readFile(path.join(root, 'src/assets/quick-links.css'), 'utf8');
const requiredStyles = [
  'grid-template-columns: repeat(5, minmax(0, 1fr))',
  'bottom: calc(var(--quick-links-tab-height) + env(safe-area-inset-bottom, 0px) + 12px)',
  'border-radius: 50%',
  'background: rgba(12, 24, 40, .78)',
  '.quick-links.is-scrolled .q-top',
];
for (const required of requiredStyles) {
  if (!styles.includes(required)) errors.push(`src/assets/quick-links.css: missing responsive rule ${required}`);
}
if (styles.includes('#03c75a')) errors.push('src/assets/quick-links.css: legacy green Naver color remains');

const layout = await readFile(path.join(root, 'src/assets/site-layout.js'), 'utf8');
if (!layout.includes('href=\"https://cafe.naver.com/newaileaders\"')) {
  errors.push('src/assets/site-layout.js: missing footer Naver Cafe link');
}
if (!layout.includes('aria-label=\"네이버 카페 새 창에서 열기\"') || !layout.includes('fill=\"currentColor\"') || !layout.includes('fill=\"#ffffff\"')) {
  errors.push('src/assets/site-layout.js: missing accessible tone-matched footer Naver Cafe icon');
}
if (!layout.includes('transform=\"translate(6.666667 6.666667) scale(.4444444)\"')) {
  errors.push('src/assets/site-layout.js: footer Naver mark must match the reduced quick-link mark');
}

if (errors.length) {
  console.error('[quick-links] FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[quick-links] PASS (${pages.length} public pages, five mobile social tabs, floating TOP button)`);
