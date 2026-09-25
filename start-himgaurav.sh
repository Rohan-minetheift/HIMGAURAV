#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
printf '%s\n' 'HIMGAURAV v7.0: http://127.0.0.1:8807/#rescue'
PORT=8807 python3 serve.py
