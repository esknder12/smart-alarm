# Android release signing

`android/app/build.gradle` signs release builds with the keystore described by
`android/signing/keystore.properties`. Both the properties file and the keystore
itself are **git-ignored** — they must never be committed.

## Repository secrets

The CI workflow `.github/workflows/build-apk.yml` ("Build APK") rebuilds both
files at run time from these secrets:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/signing/niqu.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore (store) password |
| `ANDROID_KEY_ALIAS` | key alias, e.g. `niqu` |
| `ANDROID_KEY_PASSWORD` | key password |

If the secrets are absent the build still succeeds, but the APK is signed with
the debug key (GitHub prints a warning and the artifact is not publishable).

## Local builds

```bash
base64 -w0 android/signing/niqu.keystore | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD --body "<store password>"
gh secret set ANDROID_KEY_ALIAS --body "niqu"
gh secret set ANDROID_KEY_PASSWORD --body "<key password>"
```

Keep a backup of the keystore *and* its passwords outside this machine. If they
are lost, no further update can ever be published for this app id
(`com.esknder.niqu`) — Google Play only accepts APKs signed with the original
upload key.
