#!/usr/bin/env node
import { startMCPServer } from './server.js';
startMCPServer().catch(console.error);
