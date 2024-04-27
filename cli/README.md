<!-- deno-fmt-ignore-file -->

`fedify`: the CLI toolchain for debugging fediverse apps
========================================================

The `fedify` is a CLI toolchain for debugging ActivityPub-enabled federated
server apps.  Although it is primarily designed for developers who use [Fedify],
it can be used with any ActivityPub-enabled server.

[Fedify]: https://fedify.dev/


Installation
------------

First of all, you need to install [Deno] if you haven't already.  You can
install Deno by running the following command:

~~~~ sh
curl -fsSL https://deno.land/install.sh | sh  # Linux/macOS
~~~~

~~~~ powershell
irm https://deno.land/install.ps1 | iex  # Windows
~~~~

> [!TIP]
> If you are doubtful about running scripts from the internet, there are
> additional installation options available on the [Deno installation] docs.

After installing Deno, you can install `fedify` by running the below command:

~~~~ sh
deno install -A -n fedify jsr:@fedify/cli
~~~~

[Deno]: https://deno.com/
[Deno installation]: https://docs.deno.com/runtime/manual/getting_started/installation
