plugins {
    id("com.android.application")
}

// Same approach as HanziQuery: the web game in the repo root is copied into the app's assets/www,
// so the app runs fully offline. Rebuilding the APK picks up web changes.
val webRoot = rootProject.projectDir.parentFile
val webAssetsDir = layout.buildDirectory.dir("webassets")

val copyWeb by tasks.registering(Sync::class) {
    from(webRoot) {
        include("index.html", "style.css", "favicon.svg", "privacy.html", "js/**", "music/**")
    }
    into(webAssetsDir.map { it.dir("www") })
}

// The version name is the first "# vX.Y.Z" heading of version-history.md
fun latestVersionName(): String {
    val historyFile = webRoot.resolve("version-history.md")
    if (!historyFile.exists()) return "0.0.0"
    val heading = historyFile.readLines(Charsets.UTF_8).firstOrNull { line -> line.trim().startsWith("#") } ?: return "0.0.0"
    return Regex("""[vV]\s*(\d+(?:\.\d+)*)""").find(heading)?.groupValues?.get(1) ?: "0.0.0"
}

android {
    namespace = "io.github.mrwengkb.honeycombwar"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.mrwengkb.honeycombwar"
        minSdk = 26
        targetSdk = 36
        // Every GitHub Actions build gets a higher number, so a new APK installs over the old one
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = latestVersionName()
    }

    // A fixed key, so every build is signed the same way and updates install over older versions
    signingConfigs {
        getByName("debug") {
            storeFile = file("honeycombwar.keystore")
            storePassword = "android"
            keyAlias = "honeycombwar"
            keyPassword = "android"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(webAssetsDir.get().asFile)
        }
    }

    lint {
        abortOnError = false
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.android.gms:play-services-ads:24.4.0")
}
