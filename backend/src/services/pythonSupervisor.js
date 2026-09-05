import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import { config } from '../config/env.js';

let pythonProcess = null;

/**
 * Checks if the Python server is already responding on configured URL.
 */
function isPythonServerRunning() {
  return new Promise((resolve) => {
    try {
      const healthUrl = new URL('/health', config.pythonServerUrl).toString();
      const req = http.get(healthUrl, { timeout: 1500 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Starts and supervises the Python LangGraph + Vector DB backend.
 */
export async function startPythonBackend() {
  const alreadyRunning = await isPythonServerRunning();
  if (alreadyRunning) {
    console.log(`🐍 Python LangGraph + Vector DB server is already active on ${config.pythonServerUrl}`);
    return;
  }

  const pythonDir = path.resolve('python');
  const mainPy = path.join(pythonDir, 'main.py');

  console.log(`🐍 Starting Python LangGraph + Vector DB server on ${config.pythonServerUrl}...`);

  // Spawn python process
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  pythonProcess = spawn(pythonCmd, [mainPy], {
    cwd: pythonDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.log(`[Python LangGraph] ${text}`);
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.error(`[Python LangGraph] ${text}`);
    }
  });

  pythonProcess.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.log(`[Python LangGraph] Process exited with code ${code || signal}`);
    }
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to spawn Python server:', err.message);
  });

  // Graceful shutdown handlers
  const cleanup = () => {
    if (pythonProcess) {
      console.log('🛑 Shutting down Python LangGraph server...');
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
        } else {
          pythonProcess.kill('SIGTERM');
        }
      } catch (err) {
        // ignore
      }
      pythonProcess = null;
    }
  };

  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);
}
