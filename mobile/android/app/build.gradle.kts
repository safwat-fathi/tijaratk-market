plugins {
  id("com.android.application")
}

val releaseStoreFile = providers.gradleProperty("TIJARATK_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.gradleProperty("TIJARATK_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.gradleProperty("TIJARATK_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.gradleProperty("TIJARATK_RELEASE_KEY_PASSWORD").orNull
val releaseSigningReady = listOf(
  releaseStoreFile,
  releaseStorePassword,
  releaseKeyAlias,
  releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
  namespace = "com.tijaratk.twa"
  compileSdk = 36

  defaultConfig {
    minSdk = 23
    targetSdk = 36
    versionCode = 1
    versionName = "1.0.0"
  }

  flavorDimensions += "audience"
  productFlavors {
    create("customer") {
      dimension = "audience"
      applicationId = "com.tijaratk.customer"
    }
  }

  signingConfigs {
    create("release") {
      if (releaseSigningReady) {
        storeFile = file(requireNotNull(releaseStoreFile))
        storePassword = releaseStorePassword
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
      }
    }
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false
      if (releaseSigningReady) {
        signingConfig = signingConfigs.getByName("release")
      }
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildFeatures {
    buildConfig = false
  }

  lint {
    abortOnError = true
    checkReleaseBuilds = true
  }
}

dependencies {
  implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.2")
}

