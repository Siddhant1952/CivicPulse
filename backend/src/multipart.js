// Minimal multipart/form-data parser (buffers the whole body; fine for <= ~7 MB demo uploads).
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function parseMultipart(buf, contentType = '') {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!/multipart\/form-data/i.test(contentType) || !m) {
    throw new HttpError(400, 'Expected multipart/form-data.');
  }
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const fields = {};
  const files = {};
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    pos += boundary.length;
    if (buf.subarray(pos, pos + 2).toString() === '--') break;
    pos += 2; // CRLF after boundary
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd === -1) break;
    const head = buf.subarray(pos, headEnd).toString('utf8');
    const next = buf.indexOf(boundary, headEnd + 4);
    if (next === -1) break;
    const data = buf.subarray(headEnd + 4, next - 2); // drop CRLF before next boundary
    const name = /name="([^"]*)"/i.exec(head)?.[1];
    const filename = /filename="([^"]*)"/i.exec(head)?.[1];
    if (name) {
      if (filename !== undefined) files[name] = { filename, data };
      else fields[name] = data.toString('utf8');
    }
    pos = next;
  }
  return { fields, files };
}

// Identify media by magic bytes rather than trusting client-declared types.
export function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  return null;
}
