# Fonts

This directory contains fonts baked into the Docker container.

## Included

- IBM Plex Sans JP (Regular, Medium, SemiBold, Bold, Light)

## Needed

- IBM Plex Mono (for code blocks) — download from https://github.com/IBM/plex/releases
  Place `IBMPlexMono-Regular.ttf` and `IBMPlexMono-Bold.ttf` here.

## Note

These fonts are NOT committed to git (too large). They must be placed here
before building the Docker image. The CI/CD pipeline should download them
as a build step.
