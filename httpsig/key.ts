/**
 * Checks if the given key is valid and supported.  No-op if the key is valid,
 * otherwise throws an error.
 * @param key The key to check.
 * @param type Which type of key to check.  If not specified, the key can be
 *             either public or private.
 * @throws {TypeError} If the key is invalid or unsupported.
 */
export function validateCryptoKey(
  key: CryptoKey,
  type?: "public" | "private",
): void {
  if (type != null && key.type !== type) {
    throw new TypeError(`The key is not a ${type} key.`);
  }
  if (!key.extractable) {
    throw new TypeError("The key is not extractable.");
  }
  if (key.algorithm.name != "RSASSA-PKCS1-v1_5") {
    throw new TypeError(
      "Currently only RSASSA-PKCS1-v1_5 key is supported.  " +
        "More algorithms will be added in the future!",
    );
  }
  const algorithm = key.algorithm as unknown as RsaHashedKeyAlgorithm;
  if (algorithm.hash.name != "SHA-256") {
    throw new TypeError(
      "For compatibility with the existing Fediverse software " +
        "(e.g., Mastodon), hash algorithm must be SHA-256.",
    );
  }
}
