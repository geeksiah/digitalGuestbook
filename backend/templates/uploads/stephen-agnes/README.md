# Stephen & Agnes wedding template suite

Four templates that share one editorial design system (plum, blush and gold from the
printed card; Playfair Display titles, Cormorant Garamond for italic lines, Jost for UI, Great Vibes only for the ampersand, plus an S A monogram) and link to each other.
Every page has floating actions for the most important step. The invitation is a series of full-screen sections that snap one at a time (native snapping on touch, one section per wheel gesture on desktop).

| Folder | Upload as type(s) | Notes |
| --- | --- | --- |
| `invitation/` | `INVITATION`, `LIVE_LANDING`, `EVENT_ENDED` | Phase-aware: RSVP + countdown before the day, guestbook/programme on the day, thank-you after. `template.json` declares media slots `hero`, `portrait`, `verse` and collection `gallery`. |
| `itinerary/` | `ITINERARY` | Live order of service. "Happening now" card, done check-offs with times, progress ring. Works with the 15s refresh + SSE. |
| `rsvp/` | `RSVP` | Posts to `POST /api/rsvp/:slug` per the RSVP contract (attendance, party size, phone, email, note, inviteToken). Floating submit on phones. |
| `guestbook/` | `GUESTBOOK`, `GUESTBOOK_VIDEO`, `GUESTBOOK_AUDIO`, `GUESTBOOK_PHOTO` | One page records video / voice notes and uploads photos to `POST /api/guestbook/:slug/upload`. Sub-paths open their studio directly. Honours access codes for invitation-only events. |

Zip each folder's contents and upload in Admin → Templates. Photos are not baked in:
upload them on the event as invitation media (served from the public media CDN).
