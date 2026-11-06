// A stand-in for the Thorsten voice container: answers POST /synthesize with "MP3" bytes that
// spell the text, and records what it was asked.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeVoice = Awaited<ReturnType<typeof startFakeVoice>>;

export async function startFakeVoice() {
  const requests: { text: string; lengthScale: number }[] = [];
  let failText: string | null = null;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { text: string; lengthScale: number };
      requests.push(body);
      if (body.text === failText) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"synthesis_failed"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(Buffer.from(`ID3 ${body.lengthScale} ${body.text}`));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    requests,
    failOn(text: string | null) {
      failText = text;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
