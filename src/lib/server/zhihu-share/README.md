# Zhihu share link restoration

This server-only module restores `oia.zhihu.com` and `soia.zhihu.com`
`/km_paid_content/share` links before creating crawl tasks. It does not retrieve
article text or replace the existing crawler's Cookie/content permissions.

- `resolve.ts` reads the administrator's `zhihu_access_token` runtime setting.
- `restore.ts` validates input, encrypts the original query JSON, calls the fixed
  `https://api.zhihu.com/kmap/share_restore` endpoint, and returns a canonical
  HTTPS `paid_column` or question/answer URL. Credentials and upstream response bodies are never logged.
  Payload parameters vary (`mst`, `km_pst` / `share_code`, etc.); no specific
  payload parameter name is mandatory locally. The upstream validates the query.
  Answer-only routers are expanded through the fixed `www.zhihu.com/answer/ID`
  endpoint using the existing crawler Cookie and User-Agent. Redirects are not
  followed; the returned canonical host, path, and answer ID are validated first.
- `encrypt.js` contains the public cipher configuration and initialization.
- `laes-utils.js` is the ESM adaptation of the upstream Node.js cipher class.

Protocol reference: https://github.com/onewhitethreee/zhihu_tools/issues/16

Cipher sources (Copyright (c) 2025 huaji, MIT; see `LICENSE`):

- https://github.com/zhihulite/zhihu_zse96/blob/main/nodejs/laes_utils.js
- https://github.com/zhihulite/zhihu_zse96/blob/main/python/main.py

The embedded configuration is part of the public cipher, not an account token.
Tests use synthetic share parameters and credentials. Do not add real login
responses, Cookies, tokens, or scraped articles to this directory.
