// Talks to the voice container (http://voice:5000 in production). Network trouble and a missing
// service are "unreachable"; an answer that is not MP3 is a failure of that one text.

export class VoiceUnreachable extends Error {}

export type Synthesize = (text: string, lengthScale: number) => Promise<Buffer>;

export function voiceClient(baseUrl: string, timeoutMs = 60_000): Synthesize {
  return async (text, lengthScale) => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lengthScale }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new VoiceUnreachable(`Stimme nicht erreichbar (${err instanceof Error ? err.message : String(err)})`);
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (!res.ok) throw new Error(`Stimme antwortet ${res.status}: ${body.toString('utf8').slice(0, 120)}`);
    if (!(res.headers.get('content-type') ?? '').startsWith('audio/mpeg') || body.length === 0) {
      throw new Error('Stimme lieferte kein MP3');
    }
    return body;
  };
}
