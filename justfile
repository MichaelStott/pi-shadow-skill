#!/usr/bin/env just --justfile

# Install dev dependencies
deps:
  npm i

# Default recipe
default:
  @just --list

# Install dependencies
install:
  pi install .

# Lint Typescript source files
lint:
  npm exec eslint -- extensions/

# Run unit tests
test:
  npm test

# Autoresolve lint issues
format:
  npm exec eslint -- --fix extensions/
