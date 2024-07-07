StuyPulse Attendance Kiosk
==========================

Attendance kiosk for robotics meetings. Designed for the Raspberry Pi 7" touchscreen (800x480 resolution) and the
Yokoscan EP8280 barcode scanner. Built with Electron and React.

![Screenshot of app](docs/images/screenshot.png)

## Exporting attendance report

Attendance data is stored locally on the device in a SQLite database. To export an attendance report for the current
calendar year, insert a USB drive and triple tap on the 694 logo. This will open a dialog to export a CSV file in the
following format:

```
id_number,meetings_attended,total_meetings,percentage
123456789,10,10,100.00%
...
```

A given day counts as a meeting in the report if at least 10 students check in on that day.

## Development

To run the app in development mode, run:

```bash
npm start
```

This will start the Electron app with hot reloading enabled. Changes to the frontend (renderer process) code will take
effect automatically, but changes to the main process require restarting the app.

## Building

To build the app for the Raspberry Pi, run:

```bash
npm run make:pi
```

This will build deb packages for the `arm64` and `armv7l` architectures. The `arm64` package is appropriate for the
Raspberry Pi 5, which is what we use in production. To install the package on the Raspberry Pi, copy the deb file to the
Raspberry Pi and run:

```bash
sudo dpkg -i attendance-kiosk_1.0.0_arm64.deb
```

## Barcode scanner configuration

The Yokoscan EP8280 scanner is configured by scanning special barcodes which can be found in the
[user manual](docs/EP8280_NFC_User_Guide.pdf).

The scanner should be configured to read only Code 39 barcodes to optimize scanner efficiency and ignore spurious reads
of the emergency QR code on student IDs, as well as other undesired inputs. The "Disable All Symbologies" code in the
manual doesn't seem to work, so unfortunately it is necessary to scan the "off" code for each symbology individually.

The length range for Code 39 should also be set to a minimum and maximum of 11 characters (the length of an OSIS number
plus start and stop characters). This configures the scanner to only read the OSIS barcode and not the other barcode on
the ID card.
