# Versión Android (APK)

Contenedor nativo (WebView) que empaqueta el juego web en un APK. Los archivos del juego
(`index.html`, `src/`, `styles/`) se copian en los assets durante la compilación, así que el APK
siempre contiene la versión actual del juego: no hay código duplicado.

- Funciona **sin conexión** (solo usa Internet para cargar las fuentes tipográficas si hay red).
- Pantalla completa en horizontal, controles táctiles en pantalla.
- Botón **Atrás** = Escape: cierra ventanas, abre el menú o pausa el partido.
- Las partidas se guardan en el almacenamiento de la app y se autoguardan al salir.

## Instalar

Copia `dist/UltimateLegends.apk` al móvil y ábrelo (activa «Instalar apps de origen desconocido»).
Requiere Android 8.0 o superior.

## Compilar

Requisitos: JDK 17+ y Android SDK (plataforma 35 y build-tools 35).

```bash
cd android
echo "sdk.dir=/ruta/al/android-sdk" > local.properties   # o define ANDROID_HOME
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## Firma

La build `release` se firma con la clave de depuración de la máquina que compila, para poder
instalarla directamente. Consecuencia: un APK compilado en otro ordenador no se instala encima
de este (hay que desinstalar antes, y se pierden las partidas). Para publicar en Google Play,
crea tu propia clave con `keytool` y configura `signingConfigs.release` en `app/build.gradle`.
