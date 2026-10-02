#!/usr/bin/env node
import { run } from './index.js';
run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
