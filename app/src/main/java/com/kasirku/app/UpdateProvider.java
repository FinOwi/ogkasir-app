package com.kasirku.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;
import java.util.regex.Pattern;

// Berbagi file APK hasil unduhan update ke installer sistem.
//  content://com.kasirku.app.update/updates/<nama>.apk
public class UpdateProvider extends ContentProvider {
    private static final Pattern SAFE_APK = Pattern.compile("[A-Za-z0-9_.-]+\\.apk");

    @Override
    public boolean onCreate() { return true; }

    private File fileFor(Uri uri) {
        if (getContext() == null || uri == null) return null;
        List<String> seg = uri.getPathSegments();
        if (seg.size() != 2) return null;
        if (!"updates".equals(seg.get(0))) return null;
        String name = seg.get(1);
        if (name.contains("..") || name.contains("/")) return null;
        if (!SAFE_APK.matcher(name).matches()) return null;
        File d = getContext().getExternalFilesDir("updates");
        return d == null ? null : new File(d, name);
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(uri);
        if (f == null || !f.exists()) throw new FileNotFoundException(uri.toString());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File f = fileFor(uri);
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        if (f != null && f.exists()) c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override
    public String getType(Uri uri) { return "application/vnd.android.package-archive"; }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String s, String[] sa) { return 0; }
    @Override public int update(Uri uri, ContentValues cv, String s, String[] sa) { return 0; }
}
