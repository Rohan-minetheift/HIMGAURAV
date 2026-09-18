# Security and sensitive-data policy

HIMGAURAV is a public research repository. Real credentials must never be committed.

## Never commit

- `.env`
- ThingSpeak private read/write keys
- webhook bearer tokens
- OAuth client secrets
- API tokens
- private agency endpoints or credentials
- government alerting credentials
- SSH/private keys
- local receiver logs containing operational payloads

## Safe configuration pattern

1. Copy `.env.example` to `.env` locally.
2. Put real secrets only in `.env`.
3. `.env` is ignored by Git.
4. For hosted deployment, use the hosting provider's encrypted environment-variable settings.

## Browser-side configuration

`config.js` must contain only non-secret values. Anything sent to the browser can be inspected by users.

## If a secret is accidentally committed

Treat it as compromised:

1. Revoke or rotate it immediately.
2. Remove it from the current repository.
3. If necessary, rewrite Git history.
4. Reissue a new credential.

Do not rely on deleting the file from the latest commit alone.

## Reporting

For security concerns, open a private communication channel with the repository owner rather than posting credentials in a public issue.
