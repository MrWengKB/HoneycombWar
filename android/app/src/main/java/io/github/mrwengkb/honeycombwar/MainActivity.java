package io.github.mrwengkb.honeycombwar;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.Html;
import android.text.SpannableStringBuilder;
import android.text.TextUtils;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Offline app, built the same way as HanziQuery: the web game is packed in assets/www and loaded
 * through WebViewAssetLoader on a virtual https domain, so it works without a network and the
 * page gets a secure origin (needed for the encrypted save data).
 *
 * Check for updates: on start (and from the game's "Check for updates" button) the app asks
 * GitHub Releases for "apk-latest". When its build number is higher than this app's, it shows
 * the release notes (the newest section of version-history.md) and lets the player install the
 * update or ignore it. With no network, the automatic check stays silent.
 *
 * The page talks to the app through window.HWApp (see Bridge).
 */
public class MainActivity extends Activity {

    private static final String LOCAL_HOST = WebViewAssetLoader.DEFAULT_DOMAIN; // appassets.androidplatform.net
    private static final String START_URL = "https://" + LOCAL_HOST + "/assets/www/index.html";

    private static final String RELEASE_API =
            "https://api.github.com/repos/MrWengKB/HoneycombWar/releases/tags/apk-latest";
    private static final String RELEASE_PAGE =
            "https://github.com/MrWengKB/HoneycombWar/releases/tag/apk-latest";
    private static final Pattern VERSION_NO = Pattern.compile("[vV]\\s*(\\d+(?:\\.\\d+)*)");
    // "Build N." at the top of the release notes; N is the app's versionCode
    private static final Pattern BUILD_NO = Pattern.compile("Build\\s+(\\d+)");
    private static final Pattern MD_HEADING = Pattern.compile("^#{1,6}\\s*(.*)$");
    private static final Pattern MD_LIST_ITEM = Pattern.compile("^[-*+]\\s+(.*)$");
    private static final String PREFS = "updates";
    private static final String KEY_IGNORED = "ignoredBuild";

    // The page closes a dialog or goes back to the menu; returns "true" when it handled Back
    private static final String BACK_JS = "(function(){return !!(window.hwBack && window.hwBack());})()";

    private WebView webView;
    private static final int REQ_SIGN_IN = 41;
    private static final String DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.page_bg));
        webView = new WebView(this);
        webView.setBackgroundColor(getColor(R.color.page_bg));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        keepClearOfSystemBars(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new Bridge(), "HWApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (LOCAL_HOST.equals(uri.getHost())) return false; // the game's own pages
                openExternal(uri); // other links open in the browser
                return true;
            }
        });

        webView.loadUrl(START_URL);

        // The Play Store version is updated by Play, not by this check
        if (savedInstanceState == null && !BuildConfig.PLAY_STORE) checkForUpdate(false);
    }

    /** Android 15+ draws apps edge to edge: pad the game so it stays clear of the status and navigation bars. */
    private void keepClearOfSystemBars(View root) {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
    }

    /** window.HWApp in the page */
    private class Bridge {
        @JavascriptInterface
        public void support() {
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, SupportActivity.class)));
        }

        @JavascriptInterface
        public void checkUpdates() {
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, tr("Checking for updates…", "正在检查更新…", "正在檢查更新…"), Toast.LENGTH_SHORT).show();
                checkForUpdate(true);
            });
        }

        /** Google sign-in with the phone's own account picker; the page gets the access token in hwSignedIn(token). */
        @JavascriptInterface
        public void signIn() {
            runOnUiThread(MainActivity.this::authorize);
        }

        /** false in the Play Store version, which hides "Check for updates" */
        @JavascriptInterface
        public boolean canCheckUpdates() {
            return !BuildConfig.PLAY_STORE;
        }

        @JavascriptInterface
        public boolean canSignIn() {
            return true;
        }

        /** The language the player picked in the game ("en", "zh", "tw", or "" to follow the phone) */
        @JavascriptInterface
        public void setLang(String v) {
            Lang.set(MainActivity.this, v);
        }

        @JavascriptInterface
        public String version() {
            String v = currentVersionName();
            return v == null ? "" : v;
        }
    }

    // ---------- Google sign-in (Drive access for the encrypted save file) ----------

    private void authorize() {
        AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Arrays.asList(new Scope(DRIVE_FILE), new Scope("email"), new Scope("profile"), new Scope("openid")))
                .build();
        Identity.getAuthorizationClient(this).authorize(request)
                .addOnSuccessListener(result -> {
                    if (result.hasResolution() && result.getPendingIntent() != null) {
                        try {
                            startIntentSenderForResult(result.getPendingIntent().getIntentSender(), REQ_SIGN_IN, null, 0, 0, 0);
                        } catch (IntentSender.SendIntentException e) {
                            signInFailed("popup", e);
                        }
                    } else {
                        signedIn(result);
                    }
                })
                .addOnFailureListener(e -> signInFailed("popup", e));
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SIGN_IN) return;
        if (data == null) { signInFailed(resultCode == RESULT_CANCELED ? "denied" : "popup", "result " + resultCode); return; }
        try {
            signedIn(Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data));
        } catch (Exception e) {
            // Only Google's CANCELED status (16) means the player backed out; anything else is a real error
            boolean cancelled = e instanceof ApiException && ((ApiException) e).getStatusCode() == 16;
            signInFailed(cancelled ? "denied" : "popup", e);
        }
    }

    private void signedIn(AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) { signInFailed("popup", "no access token"); return; }
        if (!result.getGrantedScopes().contains(DRIVE_FILE)) { signInFailed("scope", "Drive not allowed"); return; }
        webView.evaluateJavascript("window.hwSignedIn && window.hwSignedIn(" + JSONObject.quote(token) + ")", null);
    }

    private void signInFailed(String code, Exception e) {
        // ApiException messages start with Google's status code, e.g. "10: " = this app's package/SHA-1 isn't registered
        String detail = e instanceof ApiException ? ((ApiException) e).getStatusCode() + ": " + e.getMessage() : String.valueOf(e.getMessage());
        // Show what Google sees, so it can be compared with the Android client in Google Cloud
        signInFailed(code, detail + " | app " + getPackageName() + " SHA-1 " + certSha1());
    }

    /** SHA-1 of the certificate this install is signed with (Play's app signing key for Play installs) */
    private String certSha1() {
        try {
            android.content.pm.Signature[] sigs;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                sigs = pi.signingInfo.getApkContentsSigners();
            } else {
                sigs = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES).signatures;
            }
            byte[] d = java.security.MessageDigest.getInstance("SHA-1").digest(sigs[0].toByteArray());
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < d.length; i++) b.append(i > 0 ? ":" : "").append(String.format("%02X", d[i]));
            return b.toString();
        } catch (Exception ex) {
            return "unknown";
        }
    }
    private void signInFailed(String code, String detail) {
        webView.evaluateJavascript("window.hwSignInFailed && window.hwSignInFailed(" + JSONObject.quote(code) + "," + JSONObject.quote(detail == null ? "" : detail) + ")", null);
    }

    // ---------- check for updates ----------

    /** manual: the player pressed "Check for updates", so report "up to date" and errors too */
    private void checkForUpdate(boolean manual) {
        new Thread(() -> {
            try {
                String json = httpGet(RELEASE_API, "application/vnd.github+json");
                if (json == null) {
                    if (manual) toast(tr("No update found. You have the latest version.", "没有找到更新，你已经是最新版本。", "沒有找到更新，你已經是最新版本。"));
                    return;
                }
                JSONObject release = new JSONObject(json);
                Matcher m = BUILD_NO.matcher(release.optString("body", ""));
                if (!m.find()) {
                    if (manual) toast(tr("No update found. You have the latest version.", "没有找到更新，你已经是最新版本。", "沒有找到更新，你已經是最新版本。"));
                    return;
                }
                final long latest = Long.parseLong(m.group(1));
                if (latest <= currentVersionCode()) {
                    if (manual) toast(tr("You have the latest version.", "你已经是最新版本。", "你已經是最新版本。"));
                    return;
                }
                if (!manual && latest == prefs().getLong(KEY_IGNORED, -1)) return; // the player ignored this one

                String url = release.optString("html_url", RELEASE_PAGE);
                JSONArray assets = release.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        if (a.optString("name", "").endsWith(".apk")) {
                            url = a.optString("browser_download_url", url);
                            break;
                        }
                    }
                }
                String body = release.optString("body", "");
                final CharSequence notes = hasHeading(body) ? markdownToStyled(firstSection(body)) : null;
                Matcher vm = VERSION_NO.matcher(release.optString("name", ""));
                final String latestVersion = vm.find() ? vm.group(1) : null;
                final String downloadUrl = url;
                runOnUiThread(() -> showUpdateDialog(downloadUrl, notes, latestVersion, latest));
            } catch (Exception e) {
                if (manual) toast(tr("Couldn't check for updates. Please check your internet connection.", "无法检查更新，请检查网络连接。", "無法檢查更新，請檢查網路連線。"));
            }
        }).start();
    }

    private void showUpdateDialog(String downloadUrl, CharSequence notes, String latestVersion, long build) {
        if (isFinishing() || isDestroyed()) return;
        SpannableStringBuilder msg = new SpannableStringBuilder(tr("A new version is available.", "有新版本可用。", "有新版本可用。"));
        String current = currentVersionName();
        if (current != null) msg.append(tr("\nInstalled: v", "\n已安装：v", "\n已安裝：v")).append(current);
        if (latestVersion != null) msg.append(tr("\nLatest: v", "\n最新：v", "\n最新：v")).append(latestVersion);
        if (notes != null && notes.length() > 0) msg.append("\n\n").append(notes);
        msg.append(tr("\n\nInstall downloads the new APK. Open it when the download finishes to install over this version. Your progress is kept.", "\n\n点“安装”会下载新的 APK。下载完成后打开它，即可覆盖安装当前版本。你的进度会保留。", "\n\n點「安裝」會下載新的 APK。下載完成後開啟它，即可覆蓋安裝目前的版本。你的進度會保留。"));

        new AlertDialog.Builder(this)
                .setTitle(tr("Update available", "有可用更新", "有可用的更新"))
                .setMessage(msg)
                .setPositiveButton(tr("Install", "安装", "安裝"), (d, w) -> openExternal(Uri.parse(downloadUrl)))
                .setNegativeButton(tr("Ignore", "忽略", "忽略"), (d, w) -> prefs().edit().putLong(KEY_IGNORED, build).apply())
                .setNeutralButton(tr("Later", "以后再说", "以後再說"), null)
                .show();
    }

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }

    /** English, Simplified or Traditional Chinese, like the game page (see Lang) */
    private String tr(String en, String zh, String tw) {
        return Lang.pick(this, en, zh, tw);
    }

    private void toast(String text) {
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show());
    }

    private static boolean hasHeading(String md) {
        for (String line : md.split("\n")) if (line.trim().startsWith("#")) return true;
        return false;
    }

    /** The first "#" heading and its lines, up to the next heading (the newest version) */
    private static String firstSection(String md) {
        StringBuilder out = new StringBuilder();
        boolean started = false;
        for (String line : md.replace("\r\n", "\n").split("\n", -1)) {
            boolean isHeading = line.trim().startsWith("#");
            if (isHeading && started) break;
            if (isHeading) started = true;
            if (started) out.append(line).append('\n');
        }
        return started ? out.toString() : md;
    }

    private static CharSequence markdownToStyled(String md) {
        return Html.fromHtml(markdownToHtml(md), Html.FROM_HTML_MODE_LEGACY);
    }

    private static String markdownToHtml(String md) {
        StringBuilder html = new StringBuilder();
        for (String raw : md.replace("\r\n", "\n").split("\n", -1)) {
            String line = raw.trim();
            Matcher h = MD_HEADING.matcher(line);
            Matcher li = MD_LIST_ITEM.matcher(line);
            if (line.isEmpty()) html.append("<br>");
            else if (h.matches()) html.append("<b><big>").append(inlineHtml(h.group(1))).append("</big></b><br>");
            else if (li.matches()) html.append("&#8226;&nbsp;").append(inlineHtml(li.group(1))).append("<br>");
            else html.append(inlineHtml(line)).append("<br>");
        }
        return html.toString().replaceAll("(<br>){3,}", "<br><br>").replaceAll("(<br>)+$", "");
    }

    private static String inlineHtml(String text) {
        return TextUtils.htmlEncode(text)
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1")
                .replaceAll("\\*\\*(.+?)\\*\\*", "<b>$1</b>")
                .replace("`", "");
    }

    private static String httpGet(String url, String accept) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        try {
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept", accept);
            conn.setRequestProperty("User-Agent", "HoneycombWar-Android");
            if (conn.getResponseCode() != 200) return null;
            return readAll(conn.getInputStream());
        } finally {
            conn.disconnect();
        }
    }

    private String currentVersionName() {
        try {
            String name = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            if (name == null || name.isEmpty() || name.equals("0.0.0")) return null;
            return name.replaceFirst("^[vV]", "");
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }

    @SuppressWarnings("deprecation")
    private long currentVersionCode() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? pi.getLongVersionCode() : pi.versionCode;
        } catch (PackageManager.NameNotFoundException e) {
            return Long.MAX_VALUE;
        }
    }

    private static String readAll(InputStream in) throws Exception {
        try (InputStream is = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    // ---------- general ----------

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        webView.evaluateJavascript(BACK_JS, value -> {
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack();
            else finish();
        });
    }

    @Override
    protected void onPause() {
        // Pause the background music when the app goes to the background
        if (webView != null) webView.evaluateJavascript("window.Music && window.Music.pause && window.Music.pause()", null);
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.evaluateJavascript("window.Music && window.Music.start && window.Music.start()", null);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
