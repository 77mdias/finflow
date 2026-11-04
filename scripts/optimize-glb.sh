#!/usr/bin/env bash
# Prepara um modelo 3D de cartão para a landing e gera duas versões:
#   <saida>.glb         desktop: texturas como vieram; só a malha vai para meshopt (decodificador único e leve)
#   <saida>-mobile.glb  celular: cor em WebP q85, relevo e metal/rugosidade em 512 px, malha levemente simplificada
# Uso: bash scripts/optimize-glb.sh entrada.glb public/3D/card-5
# Requer Node (npx) e python3. Não simplifique mais que isso: com erro 0.001 as bordas do cartão amassam.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "uso: $0 <entrada.glb> <saida-sem-extensao>" >&2
  exit 64
fi
in="$1"
out="$2"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

gt() { npx -y @gltf-transform/cli@4 "$@" 2>&1 | grep -E "^error" && exit 1 || true; }

# Desktop.
gt meshopt "$in" "$out.glb" --level high --quantize-normal 10 --quantize-texcoord 14

# Celular. O `resize` só filtra texturas por nome, então nomeia cada imagem pelo slot do material.
python3 - "$in" "$tmp/a.glb" <<'PY'
import json, struct, sys
src, dst = sys.argv[1:]
data = open(src, "rb").read()
jlen = struct.unpack_from("<I", data, 12)[0]
gltf = json.loads(data[20:20 + jlen])
for mat in gltf.get("materials", []):
    pbr = mat.get("pbrMetallicRoughness", {})
    for ref, name in ((pbr.get("baseColorTexture"), "basecolor"), (pbr.get("metallicRoughnessTexture"), "mr"), (mat.get("normalTexture"), "normal")):
        if ref is not None:
            tex = gltf["textures"][ref["index"]]
            source = tex.get("source", tex.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
            gltf["images"][source]["name"] = name
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * (-len(js) % 4)
rest = data[20 + jlen:]
open(dst, "wb").write(struct.pack("<III", 0x46546C67, 2, 20 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest)
PY
gt weld "$tmp/a.glb" "$tmp/b.glb"
gt simplify "$tmp/b.glb" "$tmp/c.glb" --ratio 0 --error 0.0005
gt resize "$tmp/c.glb" "$tmp/d.glb" --pattern "normal" --width 512 --height 512
gt resize "$tmp/d.glb" "$tmp/e.glb" --pattern "mr" --width 512 --height 512
gt webp "$tmp/e.glb" "$tmp/f.glb" --slots "baseColorTexture" --quality 85
gt webp "$tmp/f.glb" "$tmp/g.glb" --slots "normalTexture" --quality 90
gt webp "$tmp/g.glb" "$tmp/h.glb" --slots "metallicRoughnessTexture" --quality 85
gt meshopt "$tmp/h.glb" "$out-mobile.glb" --level high --quantize-normal 10 --quantize-texcoord 14

ls -lh "$out.glb" "$out-mobile.glb"
