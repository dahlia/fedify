---
description: >-
  The fedify command is a CLI toolchain for debugging ActivityPub-enabled
  federated server apps.  This section explains the key features of the fedify
  command.
---

`fedify`: CLI toolchain
=======================

The `fedify` is a CLI toolchain for debugging ActivityPub-enabled federated
server apps.  Although it is primarily designed for developers who use Fedify,
it can be used with any ActivityPub-enabled server.


Installation
------------

To install `fedify`, you need to have [Deno] installed on your system.  You can
install Deno by running the following command:

::: code-group

~~~~ sh [Linux/macOS]
curl -fsSL https://deno.land/install.sh | sh
~~~~

~~~~ powershell [Windows]
irm https://deno.land/install.ps1 | iex
~~~~

:::

> [!TIP]
> If you are doubtful about running scripts from the internet, there are
> additional installation options available on the [Deno installation] docs.

After installing Deno, you can install `fedify` by running the below command:

::: code-group

~~~~ sh [Linux/macOS]
deno install \
  -A \
  --unstable-fs --unstable-kv --unstable-temporal \
  -n fedify \
  jsr:@fedify/cli
~~~~

~~~~ powershell [Windows]
deno install `
  -A `
  --unstable-fs --unstable-kv --unstable-temporal `
  -n fedify `
  jsr:@fedify/cli
~~~~

:::

[Deno]: https://deno.com/
[Deno installation]: https://docs.deno.com/runtime/manual/getting_started/installation


`fedify lookup`: Looking up an ActivityPub object
-------------------------------------------------

The `fedify lookup` command is used to look up an ActivityPub object by its URL
or an actor by its handle.

For example, the below command looks up a `Note` object with the given URL:

~~~~ sh
fedify lookup https://todon.eu/@hongminhee/112341925069749583
~~~~

The output will be like the below:

~~~~
Note {
  id: URL "https://todon.eu/users/hongminhee/statuses/112341925069749583",
  attachments: [
    Document {
      name: "The demo video on my terminal",
      url: URL "https://todon.eu/system/media_attachments/files/112/341/916/300/016/369/original/f83659866f94054f.mp"... 1 more character,
      mediaType: "video/mp4"
    }
  ],
  attribution: URL "https://todon.eu/users/hongminhee",
  contents: [
    '<p>I&#39;m working on adding a CLI toolchain to <a href="https://todon.eu/tags/Fedify" class="mentio'... 379 more characters,
    <en> '<p>I&#39;m working on adding a CLI toolchain to <a href="https://todon.eu/tags/Fedify" class="mentio'... 379 more characters
  ],
  published: 2024-04-27T07:08:57Z,
  replies: Collection {
    id: URL "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies",
    first: CollectionPage {
      items: [
        URL "https://todon.eu/users/hongminhee/statuses/112343493232608516"
      ],
      partOf: URL "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies",
      next: URL "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies?min_id=112343493232608516&page"... 5 more characters
    }
  },
  url: URL "https://todon.eu/@hongminhee/112341925069749583",
  to: URL "https://www.w3.org/ns/activitystreams#Public",
  cc: URL "https://todon.eu/users/hongminhee/followers",
  sensitive: false
}
~~~~

### `-c`/`--compact`: Compact JSON-LD

You can also output the object in the [compacted JSON-LD] format by using the
`-c`/`--compact` option:

~~~~ sh
fedify lookup --compact https://todon.eu/@hongminhee/112341925069749583
~~~~

The output will be like the below:

~~~~ json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://todon.eu/users/hongminhee/statuses/112341925069749583",
  "type": "Note",
  "attachment": {
    "type": "Document",
    "mediaType": "video/mp4",
    "name": "The demo video on my terminal",
    "url": "https://todon.eu/system/media_attachments/files/112/341/916/300/016/369/original/f83659866f94054f.mp4"
  },
  "attributedTo": "https://todon.eu/users/hongminhee",
  "cc": "https://todon.eu/users/hongminhee/followers",
  "content": "<p>I&#39;m working on adding a CLI toolchain to <a href=\"https://todon.eu/tags/Fedify\" class=\"mention hashtag\" rel=\"tag\">#<span>Fedify</span></a> to help with debugging.  The first feature I implemented is the ActivityPub object lookup.</p><p>Here&#39;s a demo.</p><p><a href=\"https://todon.eu/tags/fedidev\" class=\"mention hashtag\" rel=\"tag\">#<span>fedidev</span></a> <a href=\"https://todon.eu/tags/ActivityPub\" class=\"mention hashtag\" rel=\"tag\">#<span>ActivityPub</span></a></p>",
  "contentMap": {
    "en": "<p>I&#39;m working on adding a CLI toolchain to <a href=\"https://todon.eu/tags/Fedify\" class=\"mention hashtag\" rel=\"tag\">#<span>Fedify</span></a> to help with debugging.  The first feature I implemented is the ActivityPub object lookup.</p><p>Here&#39;s a demo.</p><p><a href=\"https://todon.eu/tags/fedidev\" class=\"mention hashtag\" rel=\"tag\">#<span>fedidev</span></a> <a href=\"https://todon.eu/tags/ActivityPub\" class=\"mention hashtag\" rel=\"tag\">#<span>ActivityPub</span></a></p>"
  },
  "published": "2024-04-27T07:08:57Z",
  "replies": {
    "id": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies",
    "type": "Collection",
    "first": {
      "type": "CollectionPage",
      "items": "https://todon.eu/users/hongminhee/statuses/112343493232608516",
      "next": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies?min_id=112343493232608516&page=true",
      "partOf": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies"
    }
  },
  "as:sensitive": false,
  "to": "as:Public",
  "url": "https://todon.eu/@hongminhee/112341925069749583"
}
~~~~

[compacted JSON-LD]: https://www.w3.org/TR/json-ld/#compacted-document-form

### `-e`/`--expanded`: Expanded JSON-LD

You can also output the object in the [expanded JSON-LD] format by using the
`-e`/`--expanded` option:

~~~~ sh
fedify lookup --expand https://todon.eu/@hongminhee/112341925069749583
~~~~

The output will be like the below:

~~~~ json
[
  {
    "@id": "https://todon.eu/users/hongminhee/statuses/112341925069749583",
    "@type": [
      "https://www.w3.org/ns/activitystreams#Note"
    ],
    "https://www.w3.org/ns/activitystreams#attachment": [
      {
        "@type": [
          "https://www.w3.org/ns/activitystreams#Document"
        ],
        "https://www.w3.org/ns/activitystreams#mediaType": [
          {
            "@value": "video/mp4"
          }
        ],
        "https://www.w3.org/ns/activitystreams#name": [
          {
            "@value": "The demo video on my terminal"
          }
        ],
        "https://www.w3.org/ns/activitystreams#url": [
          {
            "@id": "https://todon.eu/system/media_attachments/files/112/341/916/300/016/369/original/f83659866f94054f.mp4"
          }
        ]
      }
    ],
    "https://www.w3.org/ns/activitystreams#attributedTo": [
      {
        "@id": "https://todon.eu/users/hongminhee"
      }
    ],
    "https://www.w3.org/ns/activitystreams#cc": [
      {
        "@id": "https://todon.eu/users/hongminhee/followers"
      }
    ],
    "https://www.w3.org/ns/activitystreams#content": [
      {
        "@value": "<p>I&#39;m working on adding a CLI toolchain to <a href=\"https://todon.eu/tags/Fedify\" class=\"mention hashtag\" rel=\"tag\">#<span>Fedify</span></a> to help with debugging.  The first feature I implemented is the ActivityPub object lookup.</p><p>Here&#39;s a demo.</p><p><a href=\"https://todon.eu/tags/fedidev\" class=\"mention hashtag\" rel=\"tag\">#<span>fedidev</span></a> <a href=\"https://todon.eu/tags/ActivityPub\" class=\"mention hashtag\" rel=\"tag\">#<span>ActivityPub</span></a></p>"
      },
      {
        "@language": "en",
        "@value": "<p>I&#39;m working on adding a CLI toolchain to <a href=\"https://todon.eu/tags/Fedify\" class=\"mention hashtag\" rel=\"tag\">#<span>Fedify</span></a> to help with debugging.  The first feature I implemented is the ActivityPub object lookup.</p><p>Here&#39;s a demo.</p><p><a href=\"https://todon.eu/tags/fedidev\" class=\"mention hashtag\" rel=\"tag\">#<span>fedidev</span></a> <a href=\"https://todon.eu/tags/ActivityPub\" class=\"mention hashtag\" rel=\"tag\">#<span>ActivityPub</span></a></p>"
      }
    ],
    "https://www.w3.org/ns/activitystreams#published": [
      {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
        "@value": "2024-04-27T07:08:57Z"
      }
    ],
    "https://www.w3.org/ns/activitystreams#replies": [
      {
        "@id": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies",
        "@type": [
          "https://www.w3.org/ns/activitystreams#Collection"
        ],
        "https://www.w3.org/ns/activitystreams#first": [
          {
            "@type": [
              "https://www.w3.org/ns/activitystreams#CollectionPage"
            ],
            "https://www.w3.org/ns/activitystreams#items": [
              {
                "@id": "https://todon.eu/users/hongminhee/statuses/112343493232608516"
              }
            ],
            "https://www.w3.org/ns/activitystreams#next": [
              {
                "@id": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies?min_id=112343493232608516&page=true"
              }
            ],
            "https://www.w3.org/ns/activitystreams#partOf": [
              {
                "@id": "https://todon.eu/users/hongminhee/statuses/112341925069749583/replies"
              }
            ]
          }
        ]
      }
    ],
    "https://www.w3.org/ns/activitystreams#sensitive": [
      {
        "@value": false
      }
    ],
    "https://www.w3.org/ns/activitystreams#to": [
      {
        "@id": "https://www.w3.org/ns/activitystreams#Public"
      }
    ],
    "https://www.w3.org/ns/activitystreams#url": [
      {
        "@id": "https://todon.eu/@hongminhee/112341925069749583"
      }
    ]
  }
]
~~~~

[expanded JSON-LD]: https://www.w3.org/TR/json-ld/#expanded-document-form

### Looking up an actor by handle

You can also look up an actor by its handle or URL.  For example, the below
command looks up an actor with the given handle:

~~~~ sh
fedify lookup @fedify-example@fedify-blog.deno.dev
~~~~

The output will be like the below:

~~~~
Person {
  id: URL "https://fedify-blog.deno.dev/users/fedify-example",
  name: "Fedify Example Blog",
  published: 2024-03-03T13:18:11.857384756Z,
  summary: "This blog is powered by Fedify, a fediverse server framework.",
  url: URL "https://fedify-blog.deno.dev/",
  preferredUsername: "fedify-example",
  publicKey: CryptographicKey {
    id: URL "https://fedify-blog.deno.dev/users/fedify-example#main-key",
    owner: URL "https://fedify-blog.deno.dev/users/fedify-example",
    publicKey: CryptoKey {
      type: "public",
      extractable: true,
      algorithm: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 4096,
        publicExponent: Uint8Array(3) [ 1, 0, 1 ],
        hash: { name: "SHA-256" }
      },
      usages: [ "verify" ]
    }
  },
  inbox: URL "https://fedify-blog.deno.dev/users/fedify-example/inbox",
  outbox: URL "https://fedify-blog.deno.dev/users/fedify-example/outbox",
  following: URL "https://fedify-blog.deno.dev/users/fedify-example/following",
  followers: URL "https://fedify-blog.deno.dev/users/fedify-example/followers",
  endpoints: Endpoints { sharedInbox: URL "https://fedify-blog.deno.dev/inbox" },
  discoverable: true,
  suspended: false,
  memorial: false,
  indexable: true
}
~~~~

You can omit the `@` prefix when looking up an actor by handle:

~~~~ sh
fedify lookup fedify-example@fedify-blog.deno.dev
~~~~

Or you can look up an actor by `acct:` URL:

~~~~ sh
fedify lookup acct:fedify-example@fedify-blog.deno.dev
~~~~

### `-a`/`--authorized-fetch`: Authorized fetch

You can also use the `-a`/`--authorized-fetch` option to fetch the object with
authentication.  Under the hood, this option generates an one-time key pair,
spins up a temporary ActivityPub server to serve the public key, and signs
the request with the private key.

Here's an example where the `fedify lookup` fails due to the object being
protected:

~~~~ sh
fedify lookup @tchambers@indieweb.social
~~~~

The above command will output the below error:

~~~~
Failed to fetch the object.
It may be a private object.  Try with -a/--authorized-fetch.
~~~~

However, you can fetch the object with the `-a`/`--authorized-fetch` option:

~~~~ sh
fedify lookup --authorized-fetch @tchambers@indieweb.social
~~~~

This time, the above command will output the object successfully:

~~~~
Person {
  id: URL "https://indieweb.social/users/tchambers",
  attachments: [
    PropertyValue {
      name: "Indieweb Site",
      value: '<a href="http://www.timothychambers.net" target="_blank" rel="nofollow noopener noreferrer me" trans'... 128 more characters
    },
    PropertyValue {
      name: "Gravatar",
      value: '<a href="https://en.gravatar.com/tchambers" target="_blank" rel="nofollow noopener noreferrer me" tr'... 134 more characters
    },
    PropertyValue {
      name: "Threads",
      value: '<a href="https://www.threads.net/@timothyjchambers" target="_blank" rel="nofollow noopener noreferre'... 150 more characters
    },
    PropertyValue {
      name: "GitHub",
      value: '<a href="https://github.com/Timothyjchambers" target="_blank" rel="nofollow noopener noreferrer me" '... 138 more characters
    }
  ],
  name: "Tim Chambers",
  icon: Image {
    url: URL "https://cdn.masto.host/indiewebsocial/accounts/avatars/000/000/002/original/5de753df6fe336d5.png",
    mediaType: "image/png"
  },
  image: Image {
    url: URL "https://cdn.masto.host/indiewebsocial/accounts/headers/000/000/002/original/38c44f4142b84cf4.png",
    mediaType: "image/png"
  },
  published: 2019-08-30T00:00:00Z,
  summary: "<p>Technologist, writer, admin of indieweb.social. Fascinated by how new politics impacts technology"... 346 more characters,
  url: URL "https://indieweb.social/@tchambers",
  preferredUsername: "tchambers",
  publicKey: CryptographicKey {
    id: URL "https://indieweb.social/users/tchambers#main-key",
    owner: URL "https://indieweb.social/users/tchambers",
    publicKey: CryptoKey {
      type: "public",
      extractable: true,
      algorithm: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: Uint8Array(3) [ 1, 0, 1 ],
        hash: { name: "SHA-256" }
      },
      usages: [ "verify" ]
    }
  },
  manuallyApprovesFollowers: false,
  inbox: URL "https://indieweb.social/users/tchambers/inbox",
  outbox: URL "https://indieweb.social/users/tchambers/outbox",
  following: URL "https://indieweb.social/users/tchambers/following",
  followers: URL "https://indieweb.social/users/tchambers/followers",
  endpoints: Endpoints { sharedInbox: URL "https://indieweb.social/inbox" },
  discoverable: true,
  memorial: false,
  indexable: true
}
~~~~

Shell completions
-----------------

The `fedify` command supports shell completions for [Bash](#bash),
[Fish](#fish), and [Zsh](#zsh).

### Bash

To enable Bash completions add the following line to your profile file
(*~/.bashrc*, *~/.bash_profile*, or *~/.profile*):

~~~~ bash
source <(fedify completions bash)
~~~~

### Fish

To enable Fish completions add the following line to your profile file
(*~/.config/fish/config.fish*):

~~~~ fish
source (fedify completions fish | psub)
~~~~

### Zsh

To enable Zsh completions add the following line to your profile file
(*~/.zshrc*):

~~~~ zsh
source <(fedify completions zsh)
~~~~
