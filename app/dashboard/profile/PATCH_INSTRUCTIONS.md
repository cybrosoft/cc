# ProfileClient.tsx — Apply these two changes manually:

## Change 1: Remove TotpSection from bottom
Find and REMOVE this block (near bottom, before "Support Ticket notice"):
```
          {/* ── 5. Security — TOTP ── */}
          <TotpSection totpEnabled={totpEnabled} />
```

## Change 2: Add TotpSection at top with anchor
Find this comment:
```
          {/* ── 1. Account Information ── */}
```
And INSERT BEFORE it:
```
          {/* ── Security · 2FA ── */}
          <div id="security">
            <TotpSection totpEnabled={totpEnabled} />
          </div>

          {/* ── 1. Account Information ── */}
```

That's it. Two changes. Everything else stays identical.
