import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import './styles.css';
import { initCookieNotice } from './cookie.js';

initCookieNotice();

const top = document.getElementById('top');
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();
const onScroll = () => top.classList.toggle('is-scrolled', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
