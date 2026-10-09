#!/bin/bash
# Build KasirKu APK (signed dengan release key). Versi dibaca dari AndroidManifest.xml
# Hasil: KasirKu-v<versionName>.apk di direktori ini
set -e
export PATH=~/jdk17/bin:$PATH
cd "$(dirname "$0")"
BT=~/android-sdk/build-tools/34.0.0
PASS=$(cat keystore/.storepass)
VC=$(grep -oP 'versionCode="\K[0-9]+' app/src/main/AndroidManifest.xml)
VN=$(grep -oP 'versionName="\K[^"]+' app/src/main/AndroidManifest.xml)
echo "== Build KasirKu v$VN (code $VC) =="
rm -rf build && mkdir -p build/classes build/dex build/gen
javac -source 17 -target 17 -cp ~/android-sdk/platforms/android-34/android.jar -d build/classes \
  app/src/main/java/com/kasirku/app/MainActivity.java
CLASSES=$(find build/classes -name "*.class" | tr '\n' ' ')
java -cp $BT/lib/d8.jar com.android.tools.r8.D8 --min-api 29 --release --output build/dex $CLASSES
$BT/aapt2 compile --dir app/src/main/res -o build/compiled_res.zip
$BT/aapt2 link -o build/app-unsigned.apk -I ~/android-sdk/platforms/android-34/android.jar \
  --manifest app/src/main/AndroidManifest.xml --min-sdk-version 29 --target-sdk-version 34 \
  -A app/src/main/assets --java build/gen build/compiled_res.zip
cp build/dex/classes.dex build/classes.dex
zip -q -j -0 build/app-unsigned.apk build/classes.dex
$BT/zipalign -f 4 build/app-unsigned.apk build/app-aligned.apk
OUT="KasirKu-v$VN.apk"
java -jar $BT/lib/apksigner.jar sign --ks keystore/kasirku-release.keystore \
  --ks-pass pass:"$PASS" --key-pass pass:"$PASS" --out "$OUT" build/app-aligned.apk
java -jar $BT/lib/apksigner.jar verify "$OUT"
for f in app/src/main/assets/www/js/*.js; do node --check "$f"; done
echo "== OK: $OUT =="
