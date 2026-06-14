// Encoding for share links. A full session is large and highly repetitive
// JSON, so packing it raw into a URL (the old behavior) blew past browser and
// proxy length limits for real songs. New links gzip the payload first, which
// shrinks a typical session several-fold and keeps the link usable.
//
// Format: a new link is `g:` + base64url(gzip(utf8(json))). A legacy link has no
// prefix and is plain base64 of the JSON (the original scheme). The decoder
// detects the prefix, so links shared before this change still open, and we fall
// back to the legacy scheme on the rare browser without CompressionStream.

const GZIP_PREFIX = 'g:';

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const pipeThrough = async (input: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> => {
  const stream = new Response(input as unknown as BodyInit).body;
  if (!stream) {
    throw new Error('share codec: no readable stream');
  }
  const out = await new Response(stream.pipeThrough(transform)).arrayBuffer();
  return new Uint8Array(out);
};

const gzip = (input: Uint8Array): Promise<Uint8Array> => pipeThrough(input, new CompressionStream('gzip'));
const gunzip = (input: Uint8Array): Promise<Uint8Array> => pipeThrough(input, new DecompressionStream('gzip'));

// Mirror the original encoder/decoder exactly so links from before the gzip
// change still round-trip.
const legacyEncode = (text: string): string => btoa(unescape(encodeURIComponent(text)));
const legacyDecode = (text: string): string => decodeURIComponent(escape(atob(text)));

const supportsCompression = (): boolean => (
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
);

export const encodeSharePayload = async (json: string): Promise<string> => {
  const legacy = legacyEncode(json);
  if (!supportsCompression()) {
    return legacy;
  }
  try {
    const compressed = `${GZIP_PREFIX}${toBase64Url(await gzip(new TextEncoder().encode(json)))}`;
    // Tiny payloads can gzip larger than raw; keep whichever is shorter so the
    // link is never worse than before.
    return compressed.length < legacy.length ? compressed : legacy;
  } catch {
    return legacy;
  }
};

export const decodeSharePayload = async (encoded: string): Promise<string> => {
  if (encoded.startsWith(GZIP_PREFIX)) {
    if (!supportsCompression()) {
      throw new Error('share codec: gzip link needs DecompressionStream');
    }
    const decompressed = await gunzip(fromBase64Url(encoded.slice(GZIP_PREFIX.length)));
    return new TextDecoder().decode(decompressed);
  }
  return legacyDecode(encoded);
};
