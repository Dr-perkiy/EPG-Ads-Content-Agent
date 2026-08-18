const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function write(stream, icon, msg, extra) {
  stream.write(`${stamp()} ${icon} ${msg}\n`);
  if (extra !== undefined) {
    const body = typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2);
    stream.write(
      body
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n') + '\n',
    );
  }
}

export const log = {
  info: (msg, extra) => write(process.stdout, 'i ', msg, extra),
  ok: (msg, extra) => write(process.stdout, 'OK', msg, extra),
  warn: (msg, extra) => write(process.stdout, '! ', msg, extra),
  error: (msg, extra) => write(process.stderr, 'XX', msg, extra),
  step: (msg) => process.stdout.write(`\n=== ${msg} ===\n`),
};
