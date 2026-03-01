# ─────────────────────────────────────────────────────────────
# typst-pdf container — pandoc + typst + Hono HTTP server
#
# Produces native-typeset eSolia branded PDFs from markdown.
# No mermaid-cli — diagrams arrive pre-rendered from R2.
# ─────────────────────────────────────────────────────────────
FROM node:22-slim

# Install pandoc + typst
RUN apt-get update \
  && apt-get install -y --no-install-recommends pandoc curl ca-certificates xz-utils \
  && TYPST_VERSION=$(curl -sSL https://api.github.com/repos/typst/typst/releases/latest | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/') \
  && curl -sSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
     | tar -xJ --strip-components=1 -C /usr/local/bin/ \
  && apt-get purge -y curl xz-utils \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy assets (fonts, templates, logo)
COPY assets/ /app/assets/

# Install Node dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy compiled server code
COPY dist/ /app/dist/

EXPOSE 8080

CMD ["node", "dist/server.js"]
