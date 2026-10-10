package com.kasirku.app;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

/* OGKasir - printer thermal Bluetooth (ESC/POS, 58mm).
 * Cara pakai: pairing dulu di pengaturan Bluetooth HP,
 * lalu pilih printer dari aplikasi. */
public class PrinterBridge {
    public interface JsCallback { void eval(String js); }

    private final Activity act;
    private final JsCallback js;
    private BluetoothSocket socket;
    private OutputStream out;
    private String connMac = "";
    private String connName = "";
    private static final UUID SPP_UUID =
            UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"); // Bluetooth SPP

    public PrinterBridge(Activity act, JsCallback js) {
        this.act = act;
        this.js = js;
    }

    private boolean hasBtConnect() {
        if (Build.VERSION.SDK_INT >= 31) {
            return act.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private BluetoothAdapter adapter() {
        try {
            return BluetoothAdapter.getDefaultAdapter();
        } catch (Exception e) {
            return null;
        }
    }

    /* ---------- izin & bluetooth ---------- */

    @JavascriptInterface
    public boolean hasPermission() { return hasBtConnect(); }

    @JavascriptInterface
    public boolean btAvailable() { return adapter() != null; }

    @JavascriptInterface
    public boolean btEnabled() {
        BluetoothAdapter ad = adapter();
        try {
            return ad != null && ad.isEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void requestPermission() {
        // hasil kembali async via window.ogkasirBtPerm(ok)
        if (Build.VERSION.SDK_INT >= 31 && !hasBtConnect()) {
            act.requestPermissions(
                    new String[]{ android.Manifest.permission.BLUETOOTH_CONNECT }, 2002);
        } else {
            permResult(true);
        }
    }

    public void onPermResult(boolean ok) { permResult(ok); }

    private void permResult(final boolean ok) {
        if (js == null) return;
        js.eval("window.ogkasirBtPerm && window.ogkasirBtPerm(" + ok + ")");
    }

    @JavascriptInterface
    public void openBtSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Exception e) {
            Log.e("OGKasir", "openBtSettings gagal", e);
        }
    }

    /* ---------- daftar & koneksi ---------- */

    @JavascriptInterface
    public String listPrinters() {
        // daftar perangkat bluetooth yang sudah di-pairing: [{name, mac}]
        JSONArray arr = new JSONArray();
        try {
            if (!hasBtConnect()) return arr.toString();
            BluetoothAdapter ad = adapter();
            if (ad == null) return arr.toString();
            Set<BluetoothDevice> bonded = ad.getBondedDevices();
            if (bonded == null) return arr.toString();
            for (BluetoothDevice d : bonded) {
                try {
                    JSONObject o = new JSONObject();
                    String nm = d.getName();
                    o.put("name", nm == null ? "(tanpa nama)" : nm);
                    o.put("mac", d.getAddress());
                    arr.put(o);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.e("OGKasir", "listPrinters gagal", e);
        }
        return arr.toString();
    }

    @JavascriptInterface
    public void connectPrinter(final String mac) {
        // connect bisa blokir beberapa detik -> thread sendiri, hasil via callback JS
        new Thread(() -> {
            boolean ok = false;
            String name = "";
            try {
                disconnectNow();
                if (!hasBtConnect()) { connResult(false, ""); return; }
                BluetoothAdapter ad = adapter();
                if (ad == null || !ad.isEnabled()) { connResult(false, ""); return; }
                BluetoothDevice dev = ad.getRemoteDevice(mac);
                try {
                    String nm = dev.getName();
                    name = nm == null ? mac : nm;
                } catch (Exception ignored) {
                    name = mac;
                }
                try { ad.cancelDiscovery(); } catch (Exception ignored) {}
                BluetoothSocket s = dev.createRfcommSocketToServiceRecord(SPP_UUID);
                s.connect();
                out = s.getOutputStream();
                socket = s;
                connMac = mac;
                connName = name;
                ok = true;
            } catch (Exception e) {
                Log.e("OGKasir", "connectPrinter gagal", e);
                disconnectNow();
            }
            connResult(ok, ok ? name : "");
        }).start();
    }

    private void connResult(final boolean ok, final String name) {
        if (js == null) return;
        final String n = name == null ? "" : name;
        js.eval("window.ogkasirPrinterConn && window.ogkasirPrinterConn(" + ok + ","
                + JSONObject.quote(n) + ")");
    }

    @JavascriptInterface
    public void disconnectPrinter() { disconnectNow(); }

    private synchronized void disconnectNow() {
        try { if (out != null) out.close(); } catch (Exception ignored) {}
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        out = null;
        socket = null;
        connMac = "";
        connName = "";
    }

    @JavascriptInterface
    public String printerStatus() {
        JSONObject o = new JSONObject();
        try {
            boolean alive = false;
            try {
                alive = out != null && socket != null && socket.isConnected();
            } catch (Exception ignored) {}
            if (!alive) disconnectNow();
            o.put("connected", out != null && socket != null);
            o.put("name", connName);
            o.put("mac", connMac);
        } catch (Exception e) {
            Log.e("OGKasir", "printerStatus gagal", e);
        }
        return o.toString();
    }

    /* ---------- cetak ESC/POS ---------- */

    private static String sanitize(String text) {
        // printer thermal murah paling andal untuk teks ASCII
        if (text == null) return "";
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '\n' || (c >= 0x20 && c <= 0x7E)) sb.append(c);
            else sb.append('?');
        }
        return sb.toString();
    }

    @JavascriptInterface
    public synchronized boolean printText(String text) {
        try {
            if (out == null || socket == null || !socket.isConnected()) return false;
            byte[] init = new byte[]{ 0x1B, 0x40 };       // ESC @ : reset printer
            byte[] feed = new byte[]{ 0x1B, 0x64, 0x05 };  // ESC d 5 : feed 5 baris
            out.write(init);
            out.write(sanitize(text).getBytes(StandardCharsets.US_ASCII));
            out.write("\n\n".getBytes(StandardCharsets.US_ASCII));
            out.write(feed);
            out.flush();
            return true;
        } catch (Exception e) {
            Log.e("OGKasir", "printText gagal", e);
            disconnectNow();
            return false;
        }
    }

    @JavascriptInterface
    public boolean printTest() {
        String t = "      TEST PRINT OK\n" +
                "------------------------------\n" +
                "OGKasir tersambung ke\n" +
                "printer ini.\n" +
                "------------------------------\n" +
                "Jika tulisan ini tercetak\n" +
                "jelas, printer siap dipakai.\n";
        return printText(t);
    }
}
