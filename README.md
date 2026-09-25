# EventGear Partial Expo App

This is a partial classroom prototype based on the EventGear project proposal. It focuses on the proposal's first priority: a complete local booking transaction and supplier equipment CRUD.

## Implemented in this partial build

- Local customer and supplier demo role selection
- Equipment categories, browsing, and search
- Equipment details and quantity selection
- Shopping cart
- Rental date and contact form
- SQLite availability checking against overlapping pending or confirmed reservations
- Checkout with inclusive-day total calculation
- Demo payment selection with no actual charge
- Reservation creation, booking ID, history, and details
- Supplier equipment create, read, update, and delete
- Supplier reservation status updates
- SQLite data persistence after the app is closed
- Expo Router file-based routes using React Navigation stacks and bottom tabs
- Navy, teal, white, and light-gray EventGear interface

## Intentionally left for the next phase

- Administrator dashboard
- Secure registration and authentication
- Real payment processing
- Hosted database and multi-device synchronization
- Delivery logistics
- Push notifications
- Ratings and reviews

These exclusions match the scope stated in the proposal.

## Run in VS Code with Expo Go

1. Install Node.js LTS on your computer.
2. Extract this ZIP and open the `EventGear-Partial-App` folder in VS Code.
3. Open **Terminal > New Terminal**.
4. Run:

   ```bash
   npm install
   npx expo start
   ```

5. Install Expo Go on an Android phone.
6. Put the phone and computer on the same Wi-Fi network.
7. Scan the QR code shown in the terminal or browser.

If the local network blocks the connection, run:

```bash
npx expo start --tunnel
```

## Recommended professor demonstration

1. Continue as **Customer**.
2. Browse or search equipment and add items to the cart.
3. Enter rental dates, then complete checkout and the demonstration payment.
4. Show the generated booking ID under **My Rentals**.
5. Return to the role screen and continue as **Supplier**.
6. Open **Reservations** and change the booking from pending to confirmed.
7. Open **Equipment** and demonstrate add, edit, and delete operations.
8. Close and reopen Expo Go to show that SQLite retained the data.

## Important notes

- The app is intended for Android/Expo Go testing.
- All accounts and records are local demo data on one device.
- Deleting equipment is blocked when that item has an active or future reservation.
- Resetting Expo Go app data will remove the local EventGear database and restore the sample equipment on the next launch.
