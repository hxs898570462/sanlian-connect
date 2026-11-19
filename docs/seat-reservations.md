# Seat Reservations

## Scope

The reader website offers demo reservations for 23 indoor seats at the Tianjing Lake branch. Guests can see the map and availability. Readers can book, list and cancel their own reservations. The existing `stuff` role can read a roster by date and slot; it cannot change a reservation from that view.

## Seat Register

| Area | Codes | Direction | Online booking | Site verification |
| --- | --- | --- | --- | --- |
| A | A-01 to A-12 | Left window, from the bakery towards the bottom of the plan | Yes | Pending |
| B | B-01 to B-11 | Right window, from the lobby towards the B/C boundary | Yes | Pending |
| C | C-01 onwards, after counting | From the B/C boundary down along the window | No, purchase required for on-site seating | Count and positions pending |

The first page of the supplied floor plan is the geometry reference; the user's marked image determines the zones and A/B counts. The public demo uses a redrawn schematic rather than the original PDF. The numbered points are approximate until checked on site. The demo's position register is `public/js/seat-layout.js`. C codes are reserved for the on-site register and staff map; no C count or points are inferred. When the store confirms the register, check one label per physical seat, including C, and mount labels on fixed furniture or window trim. Get approval before publishing source artwork.

## Time And Data

Use the local date in Asia/Shanghai, today through six days after today, with four non-overlapping two-hour slots: 10:00, 13:00, 15:30, and 18:00. Times are for demos only. The server sets start and end timestamps. A reader may hold one seat per slot and may cancel only before the start. Cancellation releases inventory and retains the record. Availability means unreserved, not physically vacant.

The additive PostgreSQL migration creates `seats` and `seat_reservations` independently of event registrations. Foreign keys restrict inventory to the numbered A/B seats, and partial unique indexes enforce one reservation per seat and per account for an active slot.

| Request | Access | Contract |
| --- | --- | --- |
| `GET /api/seats?date=YYYY-MM-DD` | Public | Local dates, selected date, seat codes and slots with ISO timestamps and availability; no identities. Omit date for today. |
| `POST /api/seat-reservations` | Signed in | `{seat_code,date,slot}` where slot is the local start in HH:mm. Returns the created reservation; 409 for conflicts or a started slot. |
| `GET /api/seat-reservations` | Signed in | Own reservations, including cancellations, with the server's current time. |
| `POST /api/seat-reservations/:id/cancel` | Owner | Returns success only for an active future booking; 404 for missing or other readers' records. |
| `GET /api/admin/seat-reservations?date=YYYY-MM-DD&slot=HH:mm` | Staff | Slot choices and roster of seat code, display name and status. Omit date for today and slot for the first slot. |

## Tasks And Release Gates

1. Prepare the schematic and register; verify A/B count and numbering. Store staff must still verify each physical seat, label C and approve the operational map.
2. Build the public map/list, booking history, APIs and staff roster. Do not add seat payment, multi-seat booking, check-in or staff cancellations.
3. Run isolated PostgreSQL tests and verify mobile/desktop flows. Confirm inventory limits, simultaneous booking, cancellation and release, time boundaries, permissions, and restart persistence. Review the PR before deploying to shared testing. Do not enable real customer use before the store approves the opening schedule, labels and handling of walk-in conflicts.

## Verification

- `npm test`: 104 tests passed on isolated PostgreSQL. The seat test covers migration and restart, separate accounts and servers, concurrent booking, cancellation, rejected C codes, and roster permissions.
- Microsoft Edge with Playwright, 1440 px and 390 px: verified map/list selection, signup return, conflict refresh, booking, cancellation, and staff roster filters. Checked English roster and horizontal overflow.
- Physical seat locations and the C register remain unverified. This feature has not been deployed to the shared site.
