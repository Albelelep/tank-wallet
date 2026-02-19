const { spawn } = require('node:child_process');

const electronBinary = require('electron');
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/run-electron.cjs <entry-file> [args...]');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, args, {
  stdio: 'inherit',
  windowsHide: false,
  env
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`electron exited by signal: ${signal}`);
    process.exit(1);
    return;
  }
  process.exit(code ?? 1);
});
