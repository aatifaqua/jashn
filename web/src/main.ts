import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { browserStorage } from './lib/storage.ts';
import { savedTheme } from './lib/theme.ts';

const target = document.getElementById('app');
if (target === null) throw new Error('Missing #app mount point');

// Applied before mounting, so a saved theme is in place for the first paint.
const theme = savedTheme(browserStorage());
if (theme !== null) document.documentElement.dataset.theme = theme;

mount(App, { target });
