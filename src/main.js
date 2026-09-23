import './styles/main.css';
import { App } from './ui/app.js';

const host = document.getElementById('app');
const app = new App(host);
app.start();

// Handy while developing; harmless in production.
window.__kinetik = app;
