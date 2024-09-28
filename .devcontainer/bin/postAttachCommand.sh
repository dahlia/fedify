#!/bin/bash

set -e

# Run codegen
deno task -c src/deno.json codegen
deno task -c cli/deno.json codegen

# .bashrc doesn't work when creating a new container.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
export PATH="$PATH:$HOME/.bun/bin"

echo
echo "INFO: Tool version"
echo "node: $(node -v)"
deno -v
echo "bun: $(bun -v)"
echo "pnpm: $(pnpm -v)"
echo
