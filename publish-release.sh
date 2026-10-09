#!/bin/bash
# Publish rilis OGKasir ke GitHub Releases (repo FinOwi/ogkasir-app).
# Pakai: ./publish-release.sh "Catatan rilis"
# Tag = versionCode dari manifest, nama file APK = KasirKu-v<versionName>.apk
set -e
cd "$(dirname "$0")"
TOKEN=$(cat ~/workspace/duitku/.github-token)
VC=$(grep -oP 'versionCode="\K[0-9]+' app/src/main/AndroidManifest.xml)
VN=$(grep -oP 'versionName="\K[^"]+' app/src/main/AndroidManifest.xml)
NOTES=${1:-"OGKasir v$VN"}
APK="OGKasir-v$VN.apk"
[ -f "$APK" ] || { echo "Jalankan ./build.sh dulu!"; exit 1; }
echo "== Publish v$VN (tag $VC) ke FinOwi/ogkasir-app =="
export GH_TOKEN="$TOKEN" GH_VC="$VC" GH_VN="$VN" GH_NOTES="$NOTES"
RID=$(python3 -c "
import json, os, urllib.request
payload = json.dumps({'tag_name': os.environ['GH_VC'], 'name': 'v' + os.environ['GH_VN'], 'body': os.environ['GH_NOTES']}).encode()
req = urllib.request.Request('https://api.github.com/repos/FinOwi/ogkasir-app/releases', data=payload,
    headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'User-Agent': 'KasirKu-Publish'})
print(json.load(urllib.request.urlopen(req))['id'])")
echo "release id: $RID"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  "https://uploads.github.com/repos/FinOwi/ogkasir-app/releases/$RID/assets?name=$APK" \
  --data-binary @"$APK" | python3 -c "import json,sys; d=json.load(sys.stdin); print('asset:', d['name'], d['size'], 'bytes')"
echo "== Rilis v$VN terbit =="
