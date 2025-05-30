allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

subprojects {
    // Configure JVM Toolchain for all subprojects
    afterEvaluate {
        if (project.hasProperty("android")) {
            extensions.findByType<com.android.build.gradle.BaseExtension>()?.apply {
                compileOptions {
                    sourceCompatibility = JavaVersion.VERSION_11
                    targetCompatibility = JavaVersion.VERSION_11
                }
            }
        }

        // Configure Kotlin for all subprojects
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
            kotlinOptions {
                jvmTarget = "11"
                languageVersion = "1.8"
                apiVersion = "1.8"
            }
        }

        // Configure Java toolchain if available
        extensions.findByType<JavaPluginExtension>()?.apply {
            toolchain {
                languageVersion.set(JavaLanguageVersion.of(11))
            }
        }
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
