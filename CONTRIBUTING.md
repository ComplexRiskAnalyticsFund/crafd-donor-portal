## Maintenance 

Updates

```shell
npm install -g corepack
corepack prepare pnpm@latest --activate
```

Formatting

```shell
uvx ruff check --select I --fix python/
uvx ruff format python/
```