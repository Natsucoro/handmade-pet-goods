#!/usr/bin/env bash
# Claude のクラウド開発環境専用：通信の中継（プロキシ）を外してコマンドを動かす。
# この環境ではエミュレーター同士の通信が中継に横取りされて、写真のルールが正しく動かないため。
# GitHub Actions やふつうのパソコンでは不要。
exec env -u JAVA_TOOL_OPTIONS -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
  -u GLOBAL_AGENT_HTTPS_PROXY -u GLOBAL_AGENT_HTTP_PROXY -u npm_config_https_proxy -u npm_config_proxy "$@"
