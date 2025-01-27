<!-- deno-fmt-ignore-file -->

Contributing guide
==================

Thank you for considering contributing to Fedify!  This document explains how to
contribute to the project.


Bug reports
-----------

If you find a bug in Fedify, first of all, please search the [GitHub issue
tracker] to see if the bug has already been reported.  If it hasn't been
reported yet, please open a new issue.  When you open an issue, please provide
the following information:

 -  The version of Fedify you are using.
 -  The version of Deno you are using.
 -  The version of the operating system you are using.
 -  The steps to reproduce the bug.
 -  The expected behavior.
 -  The actual behavior.

[GitHub issue tracker]: https://github.com/fedify-dev/fedify/issues


Feature requests
----------------

If you have a feature request for Fedify, please search the [GitHub issue
tracker] to see if the feature has already been requested.  If it hasn't been
requested yet, please open a new issue.  When you open an issue, please provide
the following information:

 -  The use case of the feature.
 -  The expected behavior.
 -  The reason why you think the feature should be implemented in Fedify,
    instead of a third-party library or your own project.


Pull requests
-------------

### License

Fedify is licensed under the [MIT License].  By opening a pull request,
you agree to license your contribution under the MIT License.  If you cannot
agree to this license, please do not open a pull request.

[MIT License]: https://minhee.mit-license.org/2024-2025/

### Building

To build the project, see the [*Build* section](#build).

### Coding conventions

Please run the following commands before opening a pull request:

~~~~ bash
cd src/
deno task check
~~~~

### Docs

If you want to fix a typo or improve the documentation, you can open a pull
request without opening an issue.

For Markdown, we have the following conventions:

 -  80 characters at most per line, except for code blocks and URLs.
 -  Prefer [reference links] over [inline links].
 -  Prefer [setext headings] over [ATX headings].
 -  Two new lines before opening an H1/H2 heading.
 -  One space before and two spaces after a bullet.
 -  Wrap file paths in asterisks.
 -  Wrap inline code in backticks.
 -  Wrap code blocks in quadruple tildes (`~~~~`), and specify the language with
    a single space after the opening tildes (e.g., `~~~~ bash`).

In order to build the docs,
see the [*Building the docs* section](#building-the-docs).

[reference links]: https://spec.commonmark.org/0.31.2/#shortcut-reference-link
[inline links]: https://spec.commonmark.org/0.31.2/#inline-link
[setext headings]: https://spec.commonmark.org/0.31.2/#setext-headings
[ATX headings]: https://spec.commonmark.org/0.31.2/#atx-headings

### Bug fix

If you want to fix a bug in Fedify, please search the [GitHub issue tracker] to
see if the bug has already been reported.  If it hasn't been reported yet,
please open a new issue to discuss the bug.

When you open a pull request, please provide the issue number that the pull
request is related to.

A patch set should include the following:

 -  The regression test that demonstrates the bug.  It should fail without the
    patch and pass with the patch.
 -  The fix for the bug.
 -  The *CHANGES.md* entry.  The entry should include the issue number,
    the pull request number, and your name (unless you want to be anonymous).

Bug fix pull requests should target the most oldest maintenance branch that
the bug affects.  If you are not sure which branch to target, please ask in the
issue tracker.

### Feature implementation

If you want to contribute to Fedify, please open a new issue in the [GitHub
issue tracker] to discuss the change you want to make.  If the change is
accepted, you can start working on the change.  When you open a pull request,
please provide the following information:

 -  The issue number that the pull request is related to.
 -  The description of the change.
 -  The reason why the change is needed.
 -  The steps to test the change.

A patch set should include the following:

 -  The unit tests that demonstrate the feature.
 -  The implementation of the feature.
 -  If any API change was made, the documentation update for the API.
 -  Check if examples work with the change, and update the examples if needed.
 -  The *CHANGES.md* entry.  The entry should include the issue number,
    the pull request number, and your name (unless you want to be anonymous).

Feature pull requests should target the *main* branch.


Build
-----

### Directories

The repository consists of the following directories:

 -  *cli/*: The Fedify CLI.  The CLI is built with [Deno].
 -  *docs/*: The Fedify docs.  The docs are built with [Node.js] and
    [VitePress].
 -  *examples/*: The example projects.  Some examples are built with Deno, and
    some are built with Node.js.
 -  *src/*: The Fedify library.  The library is built with Deno, and tested with
    Deno, Node.js, and [Bun].
     -  *codegen/*: The code generation scripts.

[Deno]: https://deno.com/
[VitePress]: https://vitepress.dev/
[Node.js]: https://nodejs.org/
[Bun]: https://bun.sh/

### Development environment

Fedify uses [Deno] as the main development environment.  Therefore, you need to
install Deno to hack on Fedify.

> [!TIP]
> If you use [mise-en-place], a dev tools/env vars manager and a task runner,
> you can easily install Deno, [Node.js], and [Bun] with following commands:
>
> ~~~~ bash
> mise trust
> mise install
> ~~~~

The recommended editor for Fedify is [Visual Studio Code] with
the [Deno extension] installed.  Or you can use any editor that supports Deno;
see the [*Set Up Your Environment* section][1] in the Deno manual.

> [!CAUTION]
>
> Fedify heavily depends on code generation, so you need to run
> `deno task codegen` before coding or testing.

Assuming you have Deno and Visual Studio Code installed, you can open
the repository in Visual Studio Code and get ready to hack on Fedify by running
the following commands at the *root* of the repository:

~~~~ bash
pushd src
deno task codegen
popd
code .
~~~~

Note that the `deno task codegen` command is required to run only once at
very first time, or when you update the code generation scripts.   Otherwise,
you can skip the command and just run:

~~~~ bash
code .
~~~~

Immediately after running the `code .` command, Visual Studio Code will open
the repository, and you can start hacking on Fedify.  If you encounter the
following message:

> Do you want to install recommended 'Deno' extension from denoland for
> this repository?

Please click the *Install* button to install the Deno extension.

[mise-en-place]: https://mise.jdx.dev/
[Visual Studio Code]: https://code.visualstudio.com/
[Deno extension]: https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno
[1]: https://docs.deno.com/runtime/manual/getting_started/setup_your_environment/

### Running the Fedify CLI

If you want to test your changes in the Fedify CLI, you can run `deno task run`
command at the *cli/* directory.  For example, if you want to test
the `fedify lookup` subcommand, you can run the following command:

~~~~ bash
pushd cli/
deno task run lookup @fedify@hollo.social
popd
~~~~

> [!TIP]
>
> Unlike the Fedify library, the Fedify CLI does not have to be tested with
> Node.js and Bun; you can test the CLI with Deno only.

#### Running the tests

If you want to test your changes in the Fedify library, you can run
`deno task test` command at the *src/* directory:

~~~~ bash
pushd src/
deno task test
popd
~~~~

If the tests pass, you should run `deno task test-all` command to test
the library with Deno, Node.js, and [Bun]:

~~~~ bash
pushd src/
deno task test-all
popd
~~~~

Of course, Node.js and Bun should be installed on your system to run the tests
with Node.js and Bun.

> [!TIP]
> If you use [mise-en-place], a dev tools/env vars manager and a task runner,
> you can easily install Deno, [Node.js], and [Bun] with a single command:
>
> ~~~~ bash
> mise install
> ~~~~

### Building the docs

If you want to change the Fedify docs, you would like to preview the changes
in the browser.  To do that, you need to install [Bun] first.
Then you can run the following commands at the *docs/* directory:

~~~~ bash
bun install
bun dev
~~~~

Once the development server is running, you can open your browser and navigate
to *http://localhost:5173/* to view the docs.
