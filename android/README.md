# Versión Android (APK)

Contenedor nativo (WebView) que empaqueta el juego web en un APK. Los archivos del juego
(`index.html`, `src/`, `styles/`) se copian en los assets durante la compilación, así que el APK
siempre contiene la versión actual del juego: no hay código duplicado.

- Funciona **sin conexión**: juego y fuentes van dentro del APK; no pide permiso de Internet.
- Pantalla completa e inmersiva en horizontal, con la pantalla siempre encendida mientras juegas.
- **Márgenes seguros**: la app comunica al juego el tamaño del notch/recorte de cámara (variables CSS `--android-inset-*`) para que nada quede tapado.
- **Controles táctiles**: joystick analógico y botones contextuales; multitáctil (moverse y pulsar a la vez).
- **Botón Atrás**: cierra la ventana o menú superior, pausa el partido o abre el menú; en la pantalla de título sale de la app (`window.__app.handleBack()`).
- **Vibración** en goles, técnicas, entradas y fichajes (desactivable en Ajustes).
- Al pasar a segundo plano: autoguardado, pausa del partido y audio en silencio.

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
