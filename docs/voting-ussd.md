# Voting + USSD (FROG Smart USSD V2)

## Overview
This project now supports:
- Web voting (`/api/v2/voting/*`)
- Wigal FROG Smart USSD V2 callback (`/api/channels/ussd/frog/v2`)
- Offline USSD channel registration + event binding
- Event-scoped USSD credit wallets and ledger

## Offline USSD Channel Registration (Layer0)
1. Acquire channel/shortcode offline with Wigal/FROG.
2. Create the channel in EventPeepo as admin:
   - `POST /api/channels/ussd/channels`
   - Body: `codeLabel`, optional `shortcode`, optional `ownerId`, optional `status`
3. Bind channel to event:
   - `POST /api/channels/ussd/bindings`
   - Body: `ussdChannelId`, `eventId`, optional `isActive`

`codeLabel` must match the `username` sent by FROG callback payload.

## FROG Callback Contract
Endpoint:
- `POST /api/channels/ussd/frog/v2`
- `Content-Type: application/json; charset=UTF-8`

Inbound payload fields:
- Required: `network`, `sessionid`, `mode`, `userdata`, `username`, `trafficid`
- Phone: accepts `msisdn` OR `phonenumber`
- Optional: `other`

Response fields:
- Preserves: `network`, `sessionid`, `username`, `trafficid`, optional `other`
- Returns same phone key shape (`msisdn` or `phonenumber`) used by caller
- `mode` is returned as `MORE` (continue) or `END` (terminate)
- `userdata` is USSD text content

## USSD Content Rules
- Max 160 characters per page
- Newline separator is `^`
- Disallowed characters are sanitized from output: `$`, `` ` ``, `<`, `'`, `&`
- Navigation controls:
  - `0` Back
  - `00` Home
  - `99` Exit

## Credits Wallet
Wallet endpoints:
- `GET /api/channels/ussd/wallets/:eventId`
- `POST /api/channels/ussd/wallets/:eventId/topups/manual`

Credit policy:
- 1 credit unit consumed per inbound USSD interaction (`START`/`MORE`)
- Consumption is idempotent via `sessionid:trafficid`
- If balance is insufficient, session ends with polite message

## Environment Variables
- `USSD_PEPPER` (recommended): voter-key derivation secret for MSISDN hashing
- `WIGAL_IP_ALLOWLIST` (optional): comma-separated trusted callback IPs (if you enforce at edge/proxy)
- Existing API app envs still required (`DATABASE_URL`, `JWT_SECRET`, etc.)

