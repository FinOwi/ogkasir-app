package com.kasirku.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        // File chooser: biar <input type="file"> (pilih foto menu / restore) bisa buka galeri
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQ);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new Object() {
            private Uri writeToDownloads(String name, String mime, byte[] data) {
                // Simpan ke folder Download publik (Android 10+, tanpa izin khusus)
                // Kembalikan Uri file, atau null bila gagal
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return null;
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) return null;
                    os.write(data);
                    os.close();
                    return uri;
                } catch (Exception e) {
                    Log.e("KasirKu", "writeToDownloads gagal", e);
                    return null;
                }
            }

            @JavascriptInterface
            public void saveFile(String name, String mime, String content) {
                Uri uri = writeToDownloads(name, mime, content.getBytes(StandardCharsets.UTF_8));
                boolean ok = uri != null;
                saveResult(ok, name, ok ? "" : "tulis-gagal", ok ? uri.toString() : "");
            }

            @JavascriptInterface
            public void openFile(final String uriStr, final String mime) {
                // Buka file langsung di aplikasi yang sesuai (mis. Excel)
                runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setDataAndType(Uri.parse(uriStr), (mime == null || mime.isEmpty()) ? "*/*" : mime);
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(Intent.createChooser(i, "Buka file"));
                    } catch (Exception e) {
                        Log.e("KasirKu", "openFile gagal", e);
                    }
                });
            }

            // Buffer untuk terima file besar (xlsx) secara bertahap
            private final java.util.HashMap<String, java.io.ByteArrayOutputStream> chunkMap =
                    new java.util.HashMap<String, java.io.ByteArrayOutputStream>();

            @JavascriptInterface
            public synchronized int saveXlsxChunk(String name, String mime, String b64, int idx, int total) {
                // Terima potongan base64; kembalikan 1=ok, 0=gagal. Tulis file saat potongan terakhir.
                try {
                    java.io.ByteArrayOutputStream bos = chunkMap.get(name);
                    if (idx == 0 || bos == null) {
                        bos = new java.io.ByteArrayOutputStream();
                        chunkMap.put(name, bos);
                    }
                    bos.write(android.util.Base64.decode(b64, android.util.Base64.DEFAULT));
                    if (idx == total - 1) {
                        chunkMap.remove(name);
                        Uri uri = writeToDownloads(name, mime, bos.toByteArray());
                        boolean ok = uri != null;
                        saveResult(ok, name, ok ? "" : "tulis-gagal", ok ? uri.toString() : "");
                    }
                    return 1;
                } catch (Exception e) {
                    Log.e("KasirKu", "saveXlsxChunk gagal", e);
                    chunkMap.remove(name);
                    saveResult(false, name, "chunk-" + idx + ": " + String.valueOf(e.getMessage()), "");
                    return 0;
                }
            }

            @JavascriptInterface
            public void openDownloads() {
                // Buka halaman Download sistem (tempat file CSV/backup tersimpan)
                runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception e1) {
                        try {
                            Intent i2 = getPackageManager().getLaunchIntentForPackage("com.google.android.documentsui");
                            if (i2 == null) i2 = getPackageManager().getLaunchIntentForPackage("com.android.documentsui");
                            if (i2 != null) startActivity(i2);
                        } catch (Exception e2) {
                            Log.e("KasirKu", "openDownloads gagal", e2);
                        }
                    }
                });
            }

            @JavascriptInterface
            public void shareText(final String subject, final String text) {
                runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType("text/plain");
                        i.putExtra(Intent.EXTRA_SUBJECT, subject);
                        i.putExtra(Intent.EXTRA_TEXT, text);
                        startActivity(Intent.createChooser(i, subject));
                    } catch (Exception e) {
                        Log.e("KasirKu", "shareText gagal", e);
                    }
                });
            }

            @JavascriptInterface
            public String deviceId() {
                // ID unik device untuk lisensi (tidak personal, hanya untuk kode aktivasi)
                try {
                    String id = android.provider.Settings.Secure.getString(
                            getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
                    return id != null ? id : "";
                } catch (Exception e) { return ""; }
            }

            @JavascriptInterface
            public void openUrl(final String url) {
                // Buka link eksternal (IG/WA) di browser aplikasi lain
                runOnUiThread(() -> {
                    try {
                        if (url == null) return;
                        String u = url.trim();
                        if (!u.startsWith("http://") && !u.startsWith("https://")) return;
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(u));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception e) {
                        Log.e("KasirKu", "openUrl gagal", e);
                    }
                });
            }

            @JavascriptInterface
            public String appVersion() {
                try {
                    android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                    return pi.versionName + " (" + pi.versionCode + ")";
                } catch (Exception e) { return "?"; }
            }
        }, "KasirKuNative");
        setupUpdater();
        setContentView(webView);
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/www/index.html");
        }
    }

    /* ----- Auto-update via GitHub Releases ----- */
    private void setupUpdater() {
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void checkUpdate() {
                new Thread(() -> {
                    try {
                        java.net.HttpURLConnection con = (java.net.HttpURLConnection)
                                new java.net.URL("https://api.github.com/repos/FinOwi/ogkasir-app/releases/latest").openConnection();
                        con.setRequestProperty("Accept", "application/vnd.github+json");
                        con.setRequestProperty("User-Agent", "OGKasir-Updater");
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(15000);
                        if (con.getResponseCode() != 200) { updResult("{\"error\":\"HTTP " + con.getResponseCode() + "\"}"); return; }
                        java.util.Scanner sc = new java.util.Scanner(con.getInputStream(), "UTF-8").useDelimiter("\\A");
                        String body = sc.hasNext() ? sc.next() : "{}";
                        sc.close();
                        JSONObject rel = new JSONObject(body);
                        int latestCode = Integer.parseInt(rel.optString("tag_name", "0").replaceAll("[^0-9]", ""));
                        String apkUrl = "";
                        org.json.JSONArray assets = rel.optJSONArray("assets");
                        if (assets != null) for (int i = 0; i < assets.length(); i++) {
                            JSONObject a = assets.getJSONObject(i);
                            if (a.optString("name", "").endsWith(".apk")) { apkUrl = a.optString("browser_download_url", ""); break; }
                        }
                        int cur = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                        JSONObject out = new JSONObject();
                        out.put("hasUpdate", latestCode > cur && !apkUrl.isEmpty());
                        out.put("versionCode", latestCode);
                        out.put("versionName", rel.optString("name", ""));
                        out.put("notes", rel.optString("body", ""));
                        out.put("url", apkUrl);
                        out.put("current", cur);
                        updResult(out.toString());
                    } catch (Exception e) {
                        updResult("{\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "") + "\"}");
                    }
                }).start();
            }

            @JavascriptInterface
            public void downloadUpdate(final String url, final String fileName) {
                new Thread(() -> {
                    java.io.InputStream in = null;
                    java.io.FileOutputStream fos = null;
                    try {
                        java.io.File dir = getExternalFilesDir("updates");
                        if (dir != null) dir.mkdirs();
                        java.io.File out = new java.io.File(dir, fileName);
                        java.net.HttpURLConnection con = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        con.setRequestProperty("User-Agent", "OGKasir-Updater");
                        con.setRequestProperty("Accept", "application/octet-stream");
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(30000);
                        con.connect();
                        int total = con.getContentLength();
                        in = con.getInputStream();
                        fos = new java.io.FileOutputStream(out);
                        byte[] buf = new byte[8192];
                        int n, lastPct = -1;
                        long done = 0;
                        while ((n = in.read(buf)) > 0) {
                            fos.write(buf, 0, n);
                            done += n;
                            if (total > 0) {
                                int pct = (int) (done * 100 / total);
                                if (pct != lastPct) { lastPct = pct; updProgress(pct); }
                            }
                        }
                        updProgress(100);
                        installApk(fileName);
                    } catch (Exception e) {
                        updError(String.valueOf(e.getMessage()));
                    } finally {
                        try { if (fos != null) fos.close(); } catch (Exception ignored) {}
                        try { if (in != null) in.close(); } catch (Exception ignored) {}
                    }
                }).start();
            }
        }, "OGKasirUpdater");
    }

    private void updResult(final String json) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.ogkasirUpdateResult && window.ogkasirUpdateResult(" + JSONObject.quote(json) + ")", null));
    }

    private void updProgress(final int pct) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.ogkasirUpdateProgress && window.ogkasirUpdateProgress(" + pct + ")", null));
    }

    private void updError(final String msg) {
        if (webView == null) return;
        final String m = msg == null ? "?" : msg.replace("\"", "");
        webView.post(() -> webView.evaluateJavascript(
                "window.ogkasirUpdateError && window.ogkasirUpdateError(" + JSONObject.quote(m) + ")", null));
    }

    private void installApk(final String fileName) {
        runOnUiThread(() -> {
            try {
                if (android.os.Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                    Intent s = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(s);
                    webView.evaluateJavascript("window.ogkasirNeedPermission && window.ogkasirNeedPermission()", null);
                    return;
                }
                Uri uri = Uri.parse("content://com.kasirku.app.update/updates/" + fileName);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                updError(String.valueOf(e.getMessage()));
            }
        });
    }

    private void saveResult(final boolean ok, final String name, final String err, final String uri) {
        // Laporkan hasil simpan kembali ke web agar tidak gagal diam-diam
        if (webView == null) return;
        final String e = err == null ? "" : err;
        final String u = uri == null ? "" : uri;
        webView.post(() -> webView.evaluateJavascript(
                "window.kasirkuSaveCb && window.kasirkuSaveCb(" + ok + "," +
                        JSONObject.quote(name) + "," + JSONObject.quote(e) + "," + JSONObject.quote(u) + ")", null));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQ) {
            if (filePathCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
