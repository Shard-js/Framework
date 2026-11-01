import crypto from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verifies a Discord Interaction HTTP webhook request signature using Ed25519.
 *
 * @param rawBody - Raw body Buffer or string received in the HTTP request
 * @param signature - The 'X-Signature-Ed25519' header value
 * @param timestamp - The 'X-Signature-Timestamp' header value
 * @param publicKey - The application public key (32-byte hex string)
 * @returns boolean true if valid, false otherwise (fail-closed)
 */
export function verifyDiscordSignature(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  publicKey: string | null | undefined
): boolean {
  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  try {
    const rawPub = Buffer.from(publicKey, "hex");
    if (rawPub.length !== 32) {
      return false;
    }

    const spki = Buffer.concat([ED25519_SPKI_PREFIX, rawPub]);
    const keyObject = crypto.createPublicKey({
      key: spki,
      format: "der",
      type: "spki",
    });

    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const message = Buffer.concat([Buffer.from(timestamp), bodyBuf]);

    const sigBuf = Buffer.from(signature, "hex");
    if (sigBuf.length !== 64) {
      return false;
    }

    return crypto.verify(null, message, keyObject, sigBuf);
  } catch {
    return false;
  }
}
