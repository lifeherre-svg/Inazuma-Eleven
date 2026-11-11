package com.ultimatelegends.game;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.ValueCallback;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/**
 * Contenedor nativo del juego. Sirve los archivos web empaquetados en assets/www
 * mediante WebViewAssetLoader (https://appassets.androidplatform.net/), necesario
 * para que funcionen los módulos ES y el guardado en localStorage.
 */
public class MainActivity extends ComponentActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/www/index.html";
    private WebView webView;
    private Insets safeInsets = Insets.NONE;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF061331);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // guardado de partidas (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pushSafeInsets();
            }
        });
        // Márgenes seguros (notch / recortes de pantalla / barras del sistema) → variables CSS del juego.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            // Las barras del sistema están ocultas (modo inmersivo): basta con evitar el recorte de cámara.
            safeInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            pushSafeInsets();
            return insets;
        });
        setContentView(webView);
        hideSystemBars();

        // Botón "Atrás": cierra la ventana o menú superior, pausa el partido o abre el menú.
        // En la pantalla de título (nada que cerrar) sale de la app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript("window.__app ? window.__app.handleBack() : false",
                        (ValueCallback<String>) handled -> { if (!"true".equals(handled)) finish(); });
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(START_URL);
    }

    /** Envía los márgenes seguros (en píxeles CSS) al juego como variables --android-inset-*. */
    private void pushSafeInsets() {
        if (webView == null) return;
        float d = getResources().getDisplayMetrics().density;
        String js = String.format(java.util.Locale.ROOT,
                "(function(s){s.setProperty('--android-inset-top','%.1fpx');s.setProperty('--android-inset-right','%.1fpx');"
                        + "s.setProperty('--android-inset-bottom','%.1fpx');s.setProperty('--android-inset-left','%.1fpx');})(document.documentElement.style)",
                safeInsets.top / d, safeInsets.right / d, safeInsets.bottom / d, safeInsets.left / d);
        webView.evaluateJavascript(js, null);
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Fuerza el autoguardado al salir de la app y pausa el audio/animaciones.
        webView.evaluateJavascript("window.__app && window.__app.autosave(true);", null);
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
