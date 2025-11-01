// src/main.js
import { bootUI, renderAll } from './ui.js';
import './login-local.js'; // local-only auth

window.renderAll = renderAll; // preserve hook used by login-local
document.addEventListener('DOMContentLoaded', bootUI);