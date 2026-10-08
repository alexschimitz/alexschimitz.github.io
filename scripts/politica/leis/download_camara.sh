#!/bin/bash
# Baixa os arquivos em lote da Câmara usados por coerencia_camara.py (≈1,3 GB; não vão para o repositório).
# Uso: scripts/politica/leis/download_camara.sh [DESTINO]
set -u
D="${1:-../pol-leis-raw}"; mkdir -p "$D"; cd "$D"
B=https://dadosabertos.camara.leg.br/arquivos
for y in $(seq 2001 "$(date +%Y)"); do
  for f in votacoes votacoesVotos votacoesProposicoes; do
    curl -s -f -m 900 --retry 3 -o "$f-$y.csv" "$B/$f/csv/$f-$y.csv" || echo "sem $f $y"
  done
done
for y in $(seq 1988 "$(date +%Y)"); do
  curl -s -f -m 900 --retry 3 -o "proposicoesAutores-$y.csv" "$B/proposicoesAutores/csv/proposicoesAutores-$y.csv" || echo "sem autores $y"
done
