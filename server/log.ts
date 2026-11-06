// JSON lines on stdout, collected by Docker's logging driver. Never log codes or tokens.

export type Fields = Record<string, unknown>;
export type Logger = {
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
};

function write(level: string, msg: string, fields: Fields = {}): void {
  const line: Fields = { time: new Date().toISOString(), level, msg, ...fields };
  for (const [key, value] of Object.entries(line)) {
    if (value instanceof Error) line[key] = { message: value.message, stack: value.stack };
  }
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

export const log: Logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
};

export const silentLog: Logger = { info: () => {}, warn: () => {}, error: () => {} };
