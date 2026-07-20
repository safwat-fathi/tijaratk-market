# Tijaratk Android TWA

This Android project packages the deployed Tijaratk web application as Trusted
Web Activities. The initial `customer` flavor opens:

`https://www.tijaratk.com/?src=pwa-directory`

## Requirements

- Android Studio with Android SDK 36
- JDK 17
- A browser with Trusted Web Activity support on the test device

## Customer builds

Run these commands yourself from this directory; repository policy prevents AI
agents from running build or verification commands:

```sh
sh ./gradlew :app:lintCustomerDebug
sh ./gradlew :app:assembleCustomerDebug
sh ./gradlew :app:bundleCustomerRelease
```

The release AAB is unsigned unless all four properties below are defined in
your user-level `~/.gradle/gradle.properties` file:

```properties
TIJARATK_RELEASE_STORE_FILE=/absolute/path/to/upload-key.jks
TIJARATK_RELEASE_STORE_PASSWORD=replace-me
TIJARATK_RELEASE_KEY_ALIAS=replace-me
TIJARATK_RELEASE_KEY_PASSWORD=replace-me
```

Never add those values or the keystore to this repository.

## Digital Asset Links

Obtain the SHA-256 fingerprint for every certificate used to install the app
(debug, upload, and Play App Signing). Configure the frontend deployment with a
comma-separated value:

```dotenv
ANDROID_CUSTOMER_CERT_SHA256_FINGERPRINTS=AA:BB:...:FF,11:22:...:99
NEXT_PUBLIC_APP_BASE_URL=https://www.tijaratk.com
```

Verify that `https://www.tijaratk.com/.well-known/assetlinks.json` returns the
package `com.tijaratk.customer` and the matching fingerprint before testing a
fullscreen TWA or an App Link. A visible browser toolbar means the relationship
has not verified and is a release blocker.

The customer application handles `/`, `/stores`, `/market`, `/track-order`, and
`/open/store` links. It intentionally does not claim `/merchant` or `/admin`.

