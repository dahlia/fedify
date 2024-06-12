import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import {
  ed25519Multikey,
  ed25519PrivateKey,
  ed25519PublicKey,
  rsaPrivateKey2,
  rsaPublicKey2,
} from "../testing/keys.ts";
import { Create, Note } from "../vocab/vocab.ts";
import {
  createProof,
  signObject,
  verifyObject,
  type VerifyObjectOptions,
  verifyProof,
  type VerifyProofOptions,
} from "./proof.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { decodeHex } from "@std/encoding/hex";
import { decode } from "multibase";
import { DataIntegrityProof, Multikey } from "@fedify/fedify/vocab";
import { importMultibaseKey } from "@fedify/fedify/runtime";

// Test vector from <https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.feature>:
const fep8b32TestVectorPrivateKey = await crypto.subtle.importKey(
  "jwk",
  {
    "kty": "OKP",
    "crv": "Ed25519",
    // cSpell: disable
    "d": "yW756hDF5BTEcXI6_53nLDX6W3D66X6IMuysfS4rjtY",
    "x": "sA2Nk45_dz1RVlqtNqYj9TRPf10ZYPnPPo4SYg6igQ8",
    // cSpell: enable
    key_ops: ["sign"],
    ext: true,
  },
  "Ed25519",
  true,
  ["sign"],
);
const fep8b32TestVectorKeyId = new URL(
  "https://server.example/users/alice#ed25519-key",
);
const fep8b32TestVectorActivity = new Create({
  actor: new URL("https://server.example/users/alice"),
  object: new Note({
    content: "Hello world",
  }),
});

Deno.test("createProof()", async () => {
  const create = new Create({
    actor: new URL("https://example.com/person"),
    object: new Note({
      content: "Hello, world!",
    }),
  });
  const created = Temporal.Instant.from("2023-02-24T23:36:38Z");
  const proof = await createProof(
    create,
    ed25519PrivateKey,
    ed25519PublicKey.id!,
    { created, contextLoader: mockDocumentLoader },
  );
  assertEquals(proof.cryptosuite, "eddsa-jcs-2022");
  assertEquals(proof.verificationMethodId, ed25519PublicKey.id);
  assertEquals(proof.proofPurpose, "assertionMethod");
  assertEquals(
    proof.proofValue,
    decodeHex(
      "781cf7e090fcd46806fb415281a76f8a4a8d93b8f509a6c48c0fbfd06e8d0ff4" +
        "ff5f08e3b0f99adac4e5c4c39777ac1450407d5c97432831941462ada362da0c",
    ),
  );
  assertEquals(proof.created, created);
  assertEquals(
    await verifyProof(
      await create.toJsonLd({ contextLoader: mockDocumentLoader }),
      proof,
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    ed25519Multikey,
  );

  // Test vector from <https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.feature>:
  const proof2 = await createProof(
    fep8b32TestVectorActivity,
    fep8b32TestVectorPrivateKey,
    fep8b32TestVectorKeyId,
    {
      created,
      contextLoader: mockDocumentLoader,
      context: [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/data-integrity/v1",
      ],
    },
  );
  assertEquals(proof2.cryptosuite, "eddsa-jcs-2022");
  assertEquals(proof2.verificationMethodId, fep8b32TestVectorKeyId);
  assertEquals(proof2.proofPurpose, "assertionMethod");
  assertEquals(
    proof2.proofValue,
    decode(
      "z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
    ),
  );
  assertEquals(proof2.created, created);

  await assertRejects(
    () =>
      createProof(create, rsaPrivateKey2, rsaPublicKey2.id!, {
        created,
        contextLoader: mockDocumentLoader,
      }),
    TypeError,
    "Unsupported algorithm",
  );
});

Deno.test("signObject()", async () => {
  const options = {
    contextLoader: mockDocumentLoader,
    documentLoader: mockDocumentLoader,
    context: [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
    ],
  };
  const created = Temporal.Instant.from("2023-02-24T23:36:38Z");
  const signedObject = await signObject(
    fep8b32TestVectorActivity,
    fep8b32TestVectorPrivateKey,
    fep8b32TestVectorKeyId,
    { ...options, created },
  );
  assertEquals(
    await signedObject.toJsonLd(options),
    {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/data-integrity/v1",
      ],
      type: "Create",
      actor: "https://server.example/users/alice",
      object: {
        type: "Note",
        content: "Hello world",
      },
      proof: {
        type: "DataIntegrityProof",
        cryptosuite: "eddsa-jcs-2022",
        verificationMethod: "https://server.example/users/alice#ed25519-key",
        proofPurpose: "assertionMethod",
        proofValue:
          "z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
        created: "2023-02-24T23:36:38Z",
      },
    },
  );

  const signedObject2 = await signObject(
    signedObject,
    ed25519PrivateKey,
    ed25519Multikey.id!,
    { ...options, created },
  );
  assertEquals(
    await signedObject2.toJsonLd(options),
    {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/data-integrity/v1",
      ],
      type: "Create",
      actor: "https://server.example/users/alice",
      object: {
        type: "Note",
        content: "Hello world",
      },
      proof: [
        {
          type: "DataIntegrityProof",
          cryptosuite: "eddsa-jcs-2022",
          verificationMethod: "https://server.example/users/alice#ed25519-key",
          proofPurpose: "assertionMethod",
          proofValue:
            "z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
          created: "2023-02-24T23:36:38Z",
        },
        {
          created: "2023-02-24T23:36:38Z",
          cryptosuite: "eddsa-jcs-2022",
          proofPurpose: "assertionMethod",
          proofValue:
            "z4os7guLoXqReLCy135fZFVkEwvsEkUsg9jcEFQVuXM9L9H6CrqoDct8ZFuyruMDAQxaoV6S5bDKxoQUqNCLW7Tsh",
          type: "DataIntegrityProof",
          verificationMethod: "https://example.com/person2#key4",
        },
      ],
    },
  );

  await assertRejects(
    () =>
      signObject(fep8b32TestVectorActivity, rsaPrivateKey2, rsaPublicKey2.id!, {
        created,
        contextLoader: mockDocumentLoader,
      }),
    TypeError,
    "Unsupported algorithm",
  );
});

Deno.test("verifyProof()", async () => {
  const options: VerifyProofOptions = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const jsonLd = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      "https://w3id.org/security/data-integrity/v1",
      {
        Hashtag: "as:Hashtag",
        MitraJcsRsaSignature2022: "mitra:MitraJcsRsaSignature2022",
        mitra: "http://jsonld.mitra.social#",
        proofPurpose: "sec:proofPurpose",
        proofValue: "sec:proofValue",
        sensitive: "as:sensitive",
        verificationMethod: "sec:verificationMethod",
      },
    ],
    actor: "https://wizard.casa/users/hongminhee",
    id: "https://wizard.casa/objects/019006d7-95ac-3a0d-c62b-4635a4ea3294",
    object: "https://activitypub.academy/users/banulius_rakdraval",
    to: [
      "https://activitypub.academy/users/banulius_rakdraval",
    ],
    type: "Follow",
  };
  const proof = new DataIntegrityProof({
    cryptosuite: "eddsa-jcs-2022",
    proofPurpose: "assertionMethod",
    verificationMethod: new URL(
      "https://wizard.casa/users/hongminhee#ed25519-key",
    ),
    proofValue: decode(
      "zmzagWMY7wxj9By6AK27kVv9YzwuiTK7iuLgdDEVK8nHT1snicDEhXTibrPb74YCN8PGNopQnneRYST6cU4fMGnY",
    ),
    created: Temporal.Instant.from("2024-06-11T10:29:32.165658336Z"),
  });
  assertEquals(
    await verifyProof(jsonLd, proof, options),
    new Multikey({
      id: new URL("https://wizard.casa/users/hongminhee#ed25519-key"),
      controller: new URL("https://wizard.casa/users/hongminhee"),
      publicKey: await importMultibaseKey(
        "z6MkweqJajqa5jRAJTBVxxu47oCdB7HzmYbBKN8VGbFJmKkC",
      ),
    }),
  );

  // Test vector from <https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.feature>:
  const jsonLd2 = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
    ],
    type: "Create",
    actor: "https://server.example/users/alice",
    object: {
      type: "Note",
      content: "Hello world",
    },
  };
  const proof2 = new DataIntegrityProof({
    cryptosuite: "eddsa-jcs-2022",
    verificationMethod: new URL(
      "https://server.example/users/alice#ed25519-key",
    ),
    proofPurpose: "assertionMethod",
    proofValue: decode(
      "z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
    ),
    created: Temporal.Instant.from("2023-02-24T23:36:38Z"),
  });
  assertEquals(
    await verifyProof(jsonLd2, proof2, options),
    new Multikey({
      id: new URL("https://server.example/users/alice#ed25519-key"),
      controller: new URL("https://server.example/users/alice"),
      publicKey: await importMultibaseKey(
        "z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2",
      ),
    }),
  );

  const jsonLd3 = { ...jsonLd2, object: { ...jsonLd2.object, content: "bye" } };
  assertEquals(await verifyProof(jsonLd3, proof2, options), null);

  const wrongProof = proof2.clone({ created: Temporal.Now.instant() });
  assertEquals(await verifyProof(jsonLd2, wrongProof, options), null);
});

Deno.test("verifyObject()", async () => {
  const options: VerifyObjectOptions = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const create = await verifyObject({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
    ],
    type: "Create",
    actor: "https://server.example/users/alice",
    object: {
      type: "Note",
      content: "Hello world",
    },
    proof: [
      {
        type: "DataIntegrityProof",
        cryptosuite: "eddsa-jcs-2022",
        verificationMethod: "https://server.example/users/alice#ed25519-key",
        proofPurpose: "assertionMethod",
        proofValue:
          "z3sXaxjKs4M3BRicwWA9peyNPJvJqxtGsDmpt1jjoHCjgeUf71TRFz56osPSfDErszyLp5Ks1EhYSgpDaNM977Rg2",
        created: "2023-02-24T23:36:38Z",
      },
      {
        created: "2023-02-24T23:36:38Z",
        cryptosuite: "eddsa-jcs-2022",
        proofPurpose: "assertionMethod",
        proofValue:
          "z4os7guLoXqReLCy135fZFVkEwvsEkUsg9jcEFQVuXM9L9H6CrqoDct8ZFuyruMDAQxaoV6S5bDKxoQUqNCLW7Tsh",
        type: "DataIntegrityProof",
        verificationMethod: "https://example.com/person2#key4",
      },
    ],
  }, options);
  assertInstanceOf(create, Create);
  assertEquals(create.actorId, new URL("https://server.example/users/alice"));
  const note = await create.getObject(options);
  assertInstanceOf(note, Note);
  assertEquals(note.content, "Hello world");
});
