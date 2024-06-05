/// <reference lib="deno.unstable" />
import {
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
} from "@fedify/fedify/sig";
import { hash, verify } from "scrypt";
import { openKv } from "./kv.ts";

interface BlogBase {
  handle: string;
  title: string;
  description: string;
}

export interface BlogInput extends BlogBase {
  password: string;
}

export interface Blog extends BlogBase {
  passwordHash: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  ed25519PrivateKey: CryptoKey;
  ed25519PublicKey: CryptoKey;
  published: Temporal.Instant;
}

export async function setBlog(blog: BlogInput): Promise<void> {
  const kv = await openKv();
  const { privateKey, publicKey } = await generateCryptoKeyPair(
    "RSASSA-PKCS1-v1_5",
  );
  const ed25519KeyPair = await generateCryptoKeyPair("Ed25519");
  await kv.set(["blog"], {
    handle: blog.handle,
    title: blog.title,
    description: blog.description,
    published: new Date().toISOString(),
    passwordHash: hash(blog.password, undefined, "scrypt"),
    privateKey: await exportJwk(privateKey),
    publicKey: await exportJwk(publicKey),
    ed25519PrivateKey: await exportJwk(ed25519KeyPair.privateKey),
    ed25519PublicKey: await exportJwk(ed25519KeyPair.publicKey),
  });
}

export interface BlogInternal extends BlogBase {
  passwordHash: string;
  privateKey: Record<string, unknown>;
  publicKey: Record<string, unknown>;
  ed25519PrivateKey?: Record<string, unknown>;
  ed25519PublicKey?: Record<string, unknown>;
  published: string;
}

export async function getBlog(): Promise<Blog | null> {
  const kv = await openKv();
  const entry = await kv.get<BlogInternal>(["blog"]);
  if (entry == null || entry.value == null) return null;
  const { value } = entry;
  let ed25519KeyPair: CryptoKeyPair;
  if (value.ed25519PrivateKey == null || value.ed25519PublicKey == null) {
    ed25519KeyPair = await generateCryptoKeyPair("Ed25519");
    await kv.set(["blog"], {
      ...value,
      ed25519PrivateKey: await exportJwk(ed25519KeyPair.privateKey),
      ed25519PublicKey: await exportJwk(ed25519KeyPair.publicKey),
    });
  } else {
    ed25519KeyPair = {
      privateKey: await importJwk(value.ed25519PrivateKey, "private"),
      publicKey: await importJwk(value.ed25519PublicKey, "public"),
    };
  }
  return {
    ...value,
    privateKey: await importJwk(value.privateKey, "private"),
    publicKey: await importJwk(value.publicKey, "public"),
    ed25519PrivateKey: ed25519KeyPair.privateKey,
    ed25519PublicKey: ed25519KeyPair.publicKey,
    published: Temporal.Instant.from(value.published),
  };
}

export function verifyPassword(blog: Blog, password: string): boolean;
export function verifyPassword(password: string): Promise<boolean>;
export function verifyPassword(
  blogOrPassword: Blog | string,
  password?: string,
): Promise<boolean> | boolean {
  if (typeof blogOrPassword === "string") {
    return getBlog().then((blog) => {
      if (blog == null) return false;
      return verifyPassword(blog, blogOrPassword);
    });
  }
  return verify(password!, blogOrPassword.passwordHash, "scrypt");
}
