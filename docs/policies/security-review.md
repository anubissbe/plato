# Security Review

## Checks
- Secrets: addition/removal; `.env*` diffs; key formats.
- Risky ops: chmod 777, shelling out to curl|bash, deleting many files.
- Licenses: adding third-party code without notice.

## Flow
- `/security-review` runs scans on pending diffs; show findings by severity.
- Block `/apply` on high severity unless user confirms.

## Config
```yaml
security_review:
  rules:
    secrets: high
    mass_delete: high
    chmod_world_writable: medium
```
