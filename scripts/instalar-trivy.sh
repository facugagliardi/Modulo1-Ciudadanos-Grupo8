#!/usr/bin/env bash
set -euo pipefail

version=0.76.1
checksum=c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0
destino="${RUNNER_TEMP:?}/trivy-bin"
mkdir -p "$destino"
curl -fsSL --retry 3 "https://github.com/aquasecurity/trivy/releases/download/v${version}/trivy_${version}_Linux-64bit.tar.gz" -o "$destino/trivy.tar.gz"
echo "$checksum  $destino/trivy.tar.gz" | sha256sum -c -
tar -xzf "$destino/trivy.tar.gz" -C "$destino" trivy
echo "$destino" >> "${GITHUB_PATH:?}"
"$destino/trivy" --version
