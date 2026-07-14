# career-forge
ai powered cv with networking suggestions

## Acceptance Tests

### Determinism & Match Score

**Manual test (until integration test DB is available):**

1. **Determinism**: Upload resume → Add JD → Generate CV → Generate again
   - Expected: Second generation is instant (cached), outputs are byte-identical
   - Verify in Vercel logs: first run shows AI call, second shows cache hit

2. **Match Score**: After generation, check review page
   - Expected: Color-coded ATS match banner (green ≥75%, yellow ≥50%, red <50%)
   - Check database: `generated_documents.content_json.match_score` is populated

3. **No Hallucination**: Generate twice for the same resume+JD
   - Expected: No fabricated companies/institutions in either output
   - Verify Vercel logs: [FACT GATE] messages show what was stripped (or nothing if clean)

Run these before each release to production.
