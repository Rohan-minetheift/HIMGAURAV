#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
printf '%s\n' 'HIMGAURAV v8.0 Validation + SAR Lab: http://127.0.0.1:8818/#validation'
PORT=8818 python3 serve.py
