# Stable Extension ID (Dev/Unpacked)

To make `chrome.storage.sync` data persist across reinstall for an unpacked extension, lock the extension ID by adding a public key to `manifest.json`.

Steps to generate a key and obtain the public key:

1) Generate a private key (PEM) using Chrome or OpenSSL
- Chrome UI (easy):
  - Go to `chrome://extensions` → Enable Developer Mode → Pack extension
  - Select the extension folder, click Pack; Chrome creates a `.crx` and a `.pem`
  - Keep the `.pem` safe and private (do not commit it)
- OpenSSL (alternative):
  - `openssl genrsa -out omni-extension.pem 2048`

2) Derive the public key in DER and Base64
- `openssl rsa -in omni-extension.pem -pubout -outform DER | base64 | tr -d '\n' > public_key_base64.txt`
- The output is a single line Base64 string.

3) Add the public key to `manifest.json`
- Add a top-level field: `"key": "<Base64 public key here>"`
- Example:
  {
    "manifest_version": 3,
    "name": "Omni Tab Manager",
    ...,
    "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
  }

Notes
- Keep the private `.pem` outside the repo. Anyone with the private key can publish a build with your extension ID.
- Once set, the ID is derived from the public key and remains stable. Reuse the same key for future local builds to keep the same ID.
- When publishing to the Chrome Web Store, the store assigns a stable ID and you should remove the `key` field from the manifest for store builds.
