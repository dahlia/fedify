<!-- deno-fmt-ignore-file -->

`fedify`: the CLI toolchain for debugging fediverse apps
========================================================

The `fedify` is a CLI toolchain for debugging ActivityPub-enabled federated
server apps.  Although it is primarily designed for developers who use [Fedify],
it can be used with any ActivityPub-enabled server.

[Fedify]: https://fedify.dev/


Installation
------------

### Using Deno

If you have [Deno] installed, you can install `fedify` by running the following
command:

~~~~ sh
# Linux/macOS
deno install \
  -A \
  --unstable-fs --unstable-kv --unstable-temporal \
  -n fedify \
  jsr:@fedify/cli
~~~~

~~~~ powershell
# Windows
deno install `
  -A `
  --unstable-fs --unstable-kv --unstable-temporal `
  -n fedify `
  jsr:@fedify/cli
~~~~

[Deno]: https://deno.com/

### Downloading the executable

You can download the pre-built executables from the [releases] page.  Download
the appropriate executable for your platform and put it in your `PATH`.

[releases]: https://github.com/dahlia/fedify/releases
