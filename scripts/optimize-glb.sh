#!/usr/bin/env bash
# Otimiza um modelo 3D de cartão para a landing (public/3D): simplifica a malha,
# comprime com meshopt e converte texturas para WebP de até 1024 px.
# Uso: bash scripts/optimize-glb.sh entrada.glb public/3D/meucartao.glb
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "uso: $0 <entrada.glb> <saida.glb>" >&2
  exit 64
fi

npx -y @gltf-transform/cli@4 optimize "$1" "$2" \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 1024 \
  --simplify-ratio 0.02 \
  --simplify-error 0.002

ls -lh "$2"
