# Changelog

## [1.6.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.5.0...v1.6.0) (2026-02-07)


### Features

* improve tool filters, pagination, and data completeness ([#32](https://github.com/dreamiurg/mountaineers-mcp/issues/32)) ([57ff2fa](https://github.com/dreamiurg/mountaineers-mcp/commit/57ff2fa716cb462932af8175ff4051802194dae2))

## [1.5.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.4.0...v1.5.0) (2026-02-07)


### Features

* add get_route, get_course, get_activity_history, and get_my_badges tools ([#26](https://github.com/dreamiurg/mountaineers-mcp/issues/26)) ([015f5ea](https://github.com/dreamiurg/mountaineers-mcp/commit/015f5ea90e6b3e7ff0f0734a38c8a7b6eb031b72))
* add MCPB packaging for one-click Claude Desktop install ([#15](https://github.com/dreamiurg/mountaineers-mcp/issues/15)) ([46552aa](https://github.com/dreamiurg/mountaineers-mcp/commit/46552aa7e6eb9efe7402b5a2543784a447c48aff))
* add search_routes tool for routes and places ([#25](https://github.com/dreamiurg/mountaineers-mcp/issues/25)) ([fe2bf31](https://github.com/dreamiurg/mountaineers-mcp/commit/fe2bf31c63359f507829874e6d1c028bb5edb4ad))
* configure npm publishing with automated releases ([#2](https://github.com/dreamiurg/mountaineers-mcp/issues/2)) ([6329c97](https://github.com/dreamiurg/mountaineers-mcp/commit/6329c97f4e1af59348cdc97e9a7989a78eb52d40))
* initial MCP server for mountaineers.org ([a1b8061](https://github.com/dreamiurg/mountaineers-mcp/commit/a1b80618676f6340497be3f7ee7823c4a616450d))


### Bug Fixes

* correct ChatGPT Desktop MCP instructions ([#11](https://github.com/dreamiurg/mountaineers-mcp/issues/11)) ([bc0ff8c](https://github.com/dreamiurg/mountaineers-mcp/commit/bc0ff8c3462e4401b58c905917e9a09c967dce20))
* course branch filter, search result labels, tab content whitespace ([0a5e3b1](https://github.com/dreamiurg/mountaineers-mcp/commit/0a5e3b1dd2b5d0cb42b847e890dfe7634c2e6006))
* make codecov upload non-blocking in CI ([#5](https://github.com/dreamiurg/mountaineers-mcp/issues/5)) ([430d3b3](https://github.com/dreamiurg/mountaineers-mcp/commit/430d3b381e31f87901cdfd9b4eb9c20f695d5c22))
* mcpb manifest validation and output filename ([#17](https://github.com/dreamiurg/mountaineers-mcp/issues/17)) ([f180cd3](https://github.com/dreamiurg/mountaineers-mcp/commit/f180cd3ae6ef9ed11ab81310a3421d751c5857e4))
* normalize repository URL in package.json ([#8](https://github.com/dreamiurg/mountaineers-mcp/issues/8)) ([7c958f8](https://github.com/dreamiurg/mountaineers-mcp/commit/7c958f8275f2b7751fff99bf2ee00ca6424049df))
* parse activities and courses from pat-react data-props JSON ([#19](https://github.com/dreamiurg/mountaineers-mcp/issues/19)) ([89c563a](https://github.com/dreamiurg/mountaineers-mcp/commit/89c563a46d1fada9403b36687839207d21cbfa58))
* rewrite HTML parsers to match actual mountaineers.org DOM structure ([4fee04f](https://github.com/dreamiurg/mountaineers-mcp/commit/4fee04f865a9a28a780c1583cea70d4f3ff324eb))
* use Node 24 for npm publish (OIDC requires npm &gt;= 11.5) ([#13](https://github.com/dreamiurg/mountaineers-mcp/issues/13)) ([8d81d78](https://github.com/dreamiurg/mountaineers-mcp/commit/8d81d783da07e78787987fb48ad36413c6336a41))
* use Node 24 for npm publish (OIDC requires npm &gt;= 11.5) ([#29](https://github.com/dreamiurg/mountaineers-mcp/issues/29)) ([e1fe4e1](https://github.com/dreamiurg/mountaineers-mcp/commit/e1fe4e147c5b8dbde884cb508eab62bf3332a8fb))
* use npm trusted publishing (OIDC) instead of token ([#3](https://github.com/dreamiurg/mountaineers-mcp/issues/3)) ([b8cfcd4](https://github.com/dreamiurg/mountaineers-mcp/commit/b8cfcd4d25b25aa2d46439782f0aa2e700870a06))

## [1.4.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.3.0...v1.4.0) (2026-02-07)


### Features

* add get_route, get_course, get_activity_history, and get_my_badges tools ([#26](https://github.com/dreamiurg/mountaineers-mcp/issues/26)) ([015f5ea](https://github.com/dreamiurg/mountaineers-mcp/commit/015f5ea90e6b3e7ff0f0734a38c8a7b6eb031b72))

## [1.3.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.2.1...v1.3.0) (2026-02-06)


### Features

* add search_routes tool for routes and places ([#25](https://github.com/dreamiurg/mountaineers-mcp/issues/25)) ([fe2bf31](https://github.com/dreamiurg/mountaineers-mcp/commit/fe2bf31c63359f507829874e6d1c028bb5edb4ad))


### Bug Fixes

* parse activities and courses from pat-react data-props JSON ([#19](https://github.com/dreamiurg/mountaineers-mcp/issues/19)) ([89c563a](https://github.com/dreamiurg/mountaineers-mcp/commit/89c563a46d1fada9403b36687839207d21cbfa58))

## [1.2.1](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.2.0...v1.2.1) (2026-02-06)


### Bug Fixes

* mcpb manifest validation and output filename ([#17](https://github.com/dreamiurg/mountaineers-mcp/issues/17)) ([f180cd3](https://github.com/dreamiurg/mountaineers-mcp/commit/f180cd3ae6ef9ed11ab81310a3421d751c5857e4))

## [1.2.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.1.1...v1.2.0) (2026-02-06)


### Features

* add MCPB packaging for one-click Claude Desktop install ([#15](https://github.com/dreamiurg/mountaineers-mcp/issues/15)) ([46552aa](https://github.com/dreamiurg/mountaineers-mcp/commit/46552aa7e6eb9efe7402b5a2543784a447c48aff))

## [1.1.1](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.1.0...v1.1.1) (2026-02-06)


### Bug Fixes

* use Node 24 for npm publish (OIDC requires npm &gt;= 11.5) ([#13](https://github.com/dreamiurg/mountaineers-mcp/issues/13)) ([8d81d78](https://github.com/dreamiurg/mountaineers-mcp/commit/8d81d783da07e78787987fb48ad36413c6336a41))

## [1.1.0](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.0.1...v1.1.0) (2026-02-06)


### Features

* configure npm publishing with automated releases ([#2](https://github.com/dreamiurg/mountaineers-mcp/issues/2)) ([6329c97](https://github.com/dreamiurg/mountaineers-mcp/commit/6329c97f4e1af59348cdc97e9a7989a78eb52d40))
* initial MCP server for mountaineers.org ([a1b8061](https://github.com/dreamiurg/mountaineers-mcp/commit/a1b80618676f6340497be3f7ee7823c4a616450d))


### Bug Fixes

* correct ChatGPT Desktop MCP instructions ([#11](https://github.com/dreamiurg/mountaineers-mcp/issues/11)) ([bc0ff8c](https://github.com/dreamiurg/mountaineers-mcp/commit/bc0ff8c3462e4401b58c905917e9a09c967dce20))
* course branch filter, search result labels, tab content whitespace ([0a5e3b1](https://github.com/dreamiurg/mountaineers-mcp/commit/0a5e3b1dd2b5d0cb42b847e890dfe7634c2e6006))
* make codecov upload non-blocking in CI ([#5](https://github.com/dreamiurg/mountaineers-mcp/issues/5)) ([430d3b3](https://github.com/dreamiurg/mountaineers-mcp/commit/430d3b381e31f87901cdfd9b4eb9c20f695d5c22))
* normalize repository URL in package.json ([#8](https://github.com/dreamiurg/mountaineers-mcp/issues/8)) ([7c958f8](https://github.com/dreamiurg/mountaineers-mcp/commit/7c958f8275f2b7751fff99bf2ee00ca6424049df))
* rewrite HTML parsers to match actual mountaineers.org DOM structure ([4fee04f](https://github.com/dreamiurg/mountaineers-mcp/commit/4fee04f865a9a28a780c1583cea70d4f3ff324eb))
* use npm trusted publishing (OIDC) instead of token ([#3](https://github.com/dreamiurg/mountaineers-mcp/issues/3)) ([b8cfcd4](https://github.com/dreamiurg/mountaineers-mcp/commit/b8cfcd4d25b25aa2d46439782f0aa2e700870a06))

## [1.0.1](https://github.com/dreamiurg/mountaineers-mcp/compare/v1.0.0...v1.0.1) (2026-02-06)


### Bug Fixes

* normalize repository URL in package.json ([#8](https://github.com/dreamiurg/mountaineers-mcp/issues/8)) ([7c958f8](https://github.com/dreamiurg/mountaineers-mcp/commit/7c958f8275f2b7751fff99bf2ee00ca6424049df))

## 1.0.0 (2026-02-06)


### Features

* configure npm publishing with automated releases ([#2](https://github.com/dreamiurg/mountaineers-mcp/issues/2)) ([6329c97](https://github.com/dreamiurg/mountaineers-mcp/commit/6329c97f4e1af59348cdc97e9a7989a78eb52d40))
* initial MCP server for mountaineers.org ([a1b8061](https://github.com/dreamiurg/mountaineers-mcp/commit/a1b80618676f6340497be3f7ee7823c4a616450d))


### Bug Fixes

* course branch filter, search result labels, tab content whitespace ([0a5e3b1](https://github.com/dreamiurg/mountaineers-mcp/commit/0a5e3b1dd2b5d0cb42b847e890dfe7634c2e6006))
* make codecov upload non-blocking in CI ([#5](https://github.com/dreamiurg/mountaineers-mcp/issues/5)) ([430d3b3](https://github.com/dreamiurg/mountaineers-mcp/commit/430d3b381e31f87901cdfd9b4eb9c20f695d5c22))
* rewrite HTML parsers to match actual mountaineers.org DOM structure ([4fee04f](https://github.com/dreamiurg/mountaineers-mcp/commit/4fee04f865a9a28a780c1583cea70d4f3ff324eb))
* use npm trusted publishing (OIDC) instead of token ([#3](https://github.com/dreamiurg/mountaineers-mcp/issues/3)) ([b8cfcd4](https://github.com/dreamiurg/mountaineers-mcp/commit/b8cfcd4d25b25aa2d46439782f0aa2e700870a06))
