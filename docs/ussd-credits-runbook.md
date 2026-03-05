# USSD Credits Runbook

## Manual Topup
1. Find event wallet:
   - `GET /api/channels/ussd/wallets/:eventId`
2. Apply topup:
   - `POST /api/channels/ussd/wallets/:eventId/topups/manual`
   - Body:
     - `units` (int, >0)
     - `reference` (unique per wallet+type)
     - `note` (optional)

## Idempotency
- Topup idempotency key: `(walletId, type=TOPUP, reference)`
- Consume idempotency key: `(walletId, type=CONSUME, sessionid:trafficid)`

Repeat calls with same reference do not double-apply balance changes.

## Ledger
- Inspect latest 100 entries via wallet endpoint.
- `amountUnits`:
  - positive for topup/adjust credit
  - negative for consume/debit

## Common Operational Cases
- **Insufficient balance in USSD flow**:
  - User receives session `END` response
  - Top up wallet and retry session
- **Disputed debit**:
  - Check `reference=sessionid:trafficid`
  - Verify matching `UssdTrafficLog` payload/response
- **Manual reconciliation**:
  - Use `ADJUST` ledger entries (admin tooling or SQL workflow)
  - Record business reason in `metadataJson`/note

