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

[GitHub issue tracker]: https://github.com/dahlia/fedify/issues


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

[MIT License]: https://minhee.mit-license.org/2024/

### Development environment

Fedify uses [Deno] as the main development environment, and is tested with Deno,
[Node.js], and [Bun].  Therefore, you need to install Deno, Node.js, and Bun to
contribute to Fedify.

The recommended editor for Fedify is [Visual Studio Code] with
the [Deno extension] installed.  Or you can use any editor that supports Deno;
see the [*Set Up Your Environment* section][1] in the Deno manual.

> [!NOTE]
>
> Fedify heavily depends on code generation, so you need to run
> `deno task codegen` before coding or testing.

[Deno]: https://deno.com/
[Node.js]: https://nodejs.org/
[Bun]: https://bun.sh/
[Visual Studio Code]: https://code.visualstudio.com/
[Deno extension]: https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno
[1]: https://docs.deno.com/runtime/manual/getting_started/setup_your_environment/

### Coding conventions

Please run the following commands before opening a pull request:

~~~~ bash
cd src/
deno fmt
deno task check
deno task test-all
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
 -  Wrap code in backticks.

In order to build the docs, as a prerequisite, you need to install [Node.js] and
[pnpm] first. Then you can run the following commands:

~~~~ bash
cd docs/
pnpm install
pnpm dev
~~~~

Once the development server is running, you can open your browser and navigate
to *http://localhost:5173/* to view the docs.

[reference links]: https://spec.commonmark.org/0.31.2/#shortcut-reference-link
[inline links]: https://spec.commonmark.org/0.31.2/#inline-link
[setext headings]: https://spec.commonmark.org/0.31.2/#setext-headings
[ATX headings]: https://spec.commonmark.org/0.31.2/#atx-headings
[pnpm]: https://pnpm.io/

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
