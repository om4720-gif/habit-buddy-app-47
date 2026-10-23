// Encrypts the grades link before it is stored (AES-256-GCM). The key lives in the GRADE_FEED_KEY secret,
// never in the database, so a copy of the database alone can't reveal the links.

function keyBytes(): Uint8Array {
  const raw = process.env["GRADE_FEED_KEY"];
  if (!raw) throw new Error("GRADE_FEED_KEY is not set on the server.");
  const bytes = new Uint8Array(Buffer.from(raw, "base64"));
  if (bytes.length !== 32) throw new Error("GRADE_FEED_KEY must be 32 random bytes, base64 encoded.");
  return bytes;
}

async function cryptoKey() {
  return crypto.subtle.importKey("raw", keyBytes() as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const unb64 = (text: string) => Uint8Array.from(Buffer.from(text, "base64"));

export async function encryptText(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), new TextEncoder().encode(plain) as BufferSource);
  return `v1:${b64(iv)}:${b64(new Uint8Array(data))}`;
}

export async function decryptText(stored: string): Promise<string> {
  const [version, iv, data] = stored.split(":");
  if (version !== "v1" || !iv || !data) throw new Error("Stored link has an unknown format.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await cryptoKey(), unb64(data) as BufferSource);
  return new TextDecoder().decode(plain);
}
