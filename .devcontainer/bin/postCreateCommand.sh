#!/bin/bash

set -e

export BUN_VERSION="v1.1.29"
export NODE_VERSION="20"
export NVM_VERSION="v0.40.0"
export PNPM_VERSION="9.11.0"

# Setup deno completions
mkdir -p /usr/local/etc/bash_completion.d/
cat << EOF >> ~/.bashrc
deno completions bash > /usr/local/etc/bash_completion.d/deno.bash
source /usr/local/etc/bash_completion.d/deno.bash
EOF

apt update
apt upgrade -y

apt install -y git curl unzip vim

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install "$NODE_VERSION"

corepack enable
corepack install -g "pnpm@$PNPM_VERSION"

curl -fsSL https://bun.sh/install | bash -s "bun-$BUN_VERSION"
