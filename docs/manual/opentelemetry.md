---
description: >-
  OpenTelemetry is a set of APIs, libraries, agents, and instrumentation to
  provide observability to your applications.  Fedify supports OpenTelemetry
  for tracing.  This document explains how to use OpenTelemetry with Fedify.
---

OpenTelemetry
=============

*This API is available since Fedify 1.3.0.*

[OpenTelemetry] is a standardized set of APIs, libraries, agents, and
instrumentation to provide observability to your applications.  Fedify supports
OpenTelemetry for tracing.  This document explains how to use OpenTelemetry with
Fedify.

[OpenTelemetry]: https://opentelemetry.io/


Setting up OpenTelemetry
------------------------

To trace your Fedify application with OpenTelemetry, you need to set up the
OpenTelemetry SDK.  First of all, you need to install the OpenTelemetry SDK and
the tracer exporter you want to use.  For example, if you want to use the trace
exporter for OTLP (http/protobuf), you should install the following packages:

::: code-group

~~~~ sh [Deno]
deno add npm:@opentelemetry/sdk-node npm:@opentelemetry/exporter-trace-otlp-proto
~~~~

~~~~ sh [Node.js]
npm add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-proto
~~~~

~~~~ sh [Bun]
bun add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-proto
~~~~

:::

Then you can set up the OpenTelemetry SDK in your Fedify application.  Here is
an example code snippet to set up the OpenTelemetry SDK with the OTLP trace
exporter:

~~~~ typescript twoslash
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

const sdk = new NodeSDK({
  serviceName: "my-fedify-app",
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4317",
    headers: { "x-some-header": "some-value" }
  }),
});

sdk.start();
~~~~

> [!CAUTION]
> The above code which sets up the OpenTelemetry SDK needs to be executed before
> the Fedify server starts.  Otherwise, the tracing may not work as expected.


Explicit [`TracerProvider`] configuration
-----------------------------------------

The `createFederation()` function accepts the
[`tracerProvider`](./federation.md#tracerprovider) option to explicitly
configure the [`TracerProvider`] for the OpenTelemetry SDK.

For example, if you want to use [Sentry] as the trace exporter, you can set up
the Sentry SDK and pass the [`TracerProvider`] provided by the Sentry SDK to the
`createFederation()` function:

~~~~ typescript twoslash
// @noErrors: 2339
import type { KvStore } from "@fedify/fedify";
// ---cut-before---
import { createFederation } from "@fedify/fedify";
import { getClient } from "@sentry/node";

const federation = createFederation<void>({
// ---cut-start---
  kv: null as unknown as KvStore,
// ---cut-end---
  // Omitted for brevity; see the related section for details.
  tracerProvider: getClient()?.traceProvider,
});
~~~~

> [!CAUTION]
> The Sentry SDK's OpenTelemetry integration is available since [@sentry/node]
> 8.0.0, and it's not available yet in [@sentry/deno] or [@sentry/bun] as of
> November 2024.
>
> For more information about the Sentry SDK's OpenTelemetry integration, please
> refer to the [*OpenTelemetry Support* section] in the Sentry SDK docs.

[`TracerProvider`]: https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api.TracerProvider.html
[Sentry]: https://sentry.io/
[@sentry/node]: https://npmjs.com/package/@sentry/node
[@sentry/deno]: https://npmjs.com/package/@sentry/deno
[@sentry/bun]: https://npmjs.com/package/@sentry/bun
[*OpenTelemetry Support* section]: https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/


Instrumented spans
------------------

Fedify automatically instruments the following operations with OpenTelemetry
spans:

| Operation            | Description                       |
|----------------------|-----------------------------------|
| `Federation.fetch()` | Serves the incoming HTTP request. |
| `handleWebFinger()`  | Handles the WebFinger request.    |

More operations will be instrumented in the future releases.


Semantic attributes for ActivityPub
-----------------------------------

The [OpenTelemetry Semantic Conventions] currently do not have a specification
for ActivityPub as of November 2024.  However, Fedify provides a set of semantic
attributes for ActivityPub.  The following table shows the semantic attributes
for ActivityPub:

| Attribute                        | Type     | Description                                                                     | Example                                            |
|----------------------------------|----------|---------------------------------------------------------------------------------|----------------------------------------------------|
| `activitypub.activity.id`        | string   | The URI of the activity object.                                                 | `"https://example.com/activity/1"`                 |
| `activitypub.activity.type`      | string[] | The qualified URI(s) of the activity type(s).                                   | `["https://www.w3.org/ns/activitystreams#Create"]` |
| `activitypub.activity.to`        | string[] | The URI(s) of the recipient collections/actors of the activity.                 | `["https://example.com/1/followers/2"]`            |
| `activitypub.activity.cc`        | string[] | The URI(s) of the carbon-copied recipient collections/actors of the activity.   | `["https://www.w3.org/ns/activitystreams#Public"]` |
| `activitypub.activity.retries`   | int      | The ordinal number of activity resending attempt (if and only if it's retried). | `3`                                                |
| `activitypub.actor.id`           | string   | The URI of the actor object.                                                    | `"https://example.com/actor/1"`                    |
| `activitypub.actor.type`         | string[] | The qualified URI(s) of the actor type(s).                                      | `["https://www.w3.org/ns/activitystreams#Person"]` |
| `activitypub.object.id`          | string   | The URI of the object or the object enclosed by the activity.                   | `"https://example.com/object/1"`                   |
| `activitypub.object.type`        | string[] | The qualified URI(s) of the object type(s).                                     | `["https://www.w3.org/ns/activitystreams#Note"]`   |
| `activitypub.object.in_reply_to` | string[] | The URI(s) of the original object to which the object reply.                    | `["https://example.com/object/1"]`                 |
| `activitypub.inboxes`            | int      | The number of inboxes the activity is sent to.                                  | `12`                                               |
| `activitypub.shared_inbox`       | boolean  | Whether the activity is sent to the shared inbox.                               | `true`                                             |
| `webfinger.resource`             | string   | The queried resource URI.                                                       | `"acct:fedify@hollo.social"`                       |

[OpenTelemetry Semantic Conventions]: https://opentelemetry.io/docs/specs/semconv/
