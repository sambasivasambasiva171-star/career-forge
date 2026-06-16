#!/bin/bash
# === Final improved security check ===
PROJECT_NAME=$(basename "$PWD")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="security-reports-$TIMESTAMP"
mkdir -p "$REPORT_DIR"

echo "============================================"
echo "  Security check for: $PROJECT_NAME"
echo "  Scanning ONLY your real source code"
echo "  Reports saved to:   $REPORT_DIR/"
echo "============================================"
echo ""

# --- 1. Secret scan ---
echo "🔍 [1/3] Running Gitleaks (secret scanner)..."
gitleaks detect --source . \
    --report-path "$REPORT_DIR/gitleaks.json" \
    --report-format json \
    --no-banner 2>&1 | grep -E "(commits scanned|no leaks found|leaks found)" | head -3

SECRETS=$(jq 'length' "$REPORT_DIR/gitleaks.json" 2>/dev/null)
if [ -z "$SECRETS" ]; then SECRETS=0; fi

if [ "$SECRETS" = "0" ]; then
    echo "   ✅ No leaked secrets found"
else
    echo "   🚨 $SECRETS leaked secrets found:"
    jq -r '.[] | "   • \(.RuleID) in \(.File):\(.StartLine)"' "$REPORT_DIR/gitleaks.json" 2>/dev/null
fi
echo ""

# --- 2. Dependency + container + IaC scan ---
echo "📦 [2/3] Running Trivy (deps + containers + IaC)..."
trivy fs --security-checks vuln,config,secret --severity CRITICAL,HIGH . \
    --skip-dirs "node_modules,.next,repos,security-reports-*" \
    --format json --output "$REPORT_DIR/trivy.json" --quiet 2>/dev/null
HIGH_VULNS=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL" or .Severity == "HIGH")] | length' "$REPORT_DIR/trivy.json" 2>/dev/null)
if [ -z "$HIGH_VULNS" ]; then HIGH_VULNS=0; fi

if [ "$HIGH_VULNS" = "0" ]; then
    echo "   ✅ No critical/high vulnerabilities"
else
    echo "   🚨 $HIGH_VULNS critical/high vulnerabilities:"
    trivy fs --security-checks vuln --severity CRITICAL,HIGH . \
        --skip-dirs "node_modules,.next,repos" --format table --quiet 2>/dev/null | head -25
fi
echo ""

# --- 3. Code scan (SAST) ---
echo "🐛 [3/3] Running Semgrep (code scanner)..."
semgrep scan --config auto --json --output "$REPORT_DIR/semgrep.json" --quiet \
    --exclude ".next" --exclude "node_modules" --exclude "dist" --exclude "build" --exclude "repos" 2>/dev/null
ERRORS=$(jq '.results | length' "$REPORT_DIR/semgrep.json" 2>/dev/null)
if [ -z "$ERRORS" ]; then ERRORS=0; fi

if [ "$ERRORS" = "0" ]; then
    echo "   ✅ No code security issues found"
else
    echo "   🚨 $ERRORS code issues found:"
    jq -r '.results[] | "   • \(.check_id) in \(.path):\(.start.line) — \(.extra.message)"' "$REPORT_DIR/semgrep.json" 2>/dev/null | head -15
fi
echo ""

# --- Final verdict ---
echo "============================================"
echo "  FINAL VERDICT"
echo "============================================"
TOTAL=$((SECRETS + HIGH_VULNS + ERRORS))
if [ "$TOTAL" = "0" ]; then
    echo "  ✅ SHIP IT — all 3 scans clean"
else
    echo "  🛑 DO NOT SHIP — $TOTAL total issues found"
    echo "  Open $REPORT_DIR/ for full reports"
    echo "  Paste this output back to Z.ai for plain-English explanation"
fi
echo "============================================"
