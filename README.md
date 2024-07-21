StuyPulse Attendance Kiosk
==========================

Attendance kiosk for robotics meetings. Designed for the Raspberry Pi 7" touchscreen (800x480 resolution) and the
Yokoscan EP8280 barcode scanner. Built with Electron and React.

![Screenshot of app](docs/images/screenshot.png)

## Exporting reports

Attendance data is stored locally on the device in a SQLite database. To export attendance reports, insert a USB drive
and triple tap on the 694 logo. The following report types are available:

- **Attendance Report** - Number of meetings attended and attendance rate for each student
- **Meeting Report** - Total unique checkins for each meeting day

## Development

To run the app in development mode, run:

```bash
npm start
```

This will start the Electron app with hot reloading enabled. Changes to the frontend (renderer process) code will take
effect automatically, but changes to the main process require restarting the app.

## Building

To build an `arm64` deb package for the Raspberry Pi, run:

```bash
npm run make:pi
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

## Raspberry Pi setup

Install the latest Raspberry Pi OS onto a microSD card using the Raspberry Pi Imager, then insert the microSD card into
the Raspberry Pi and boot. Connect to Wi-Fi.

Upgrade and install packages:

```bash
sudo apt-get update
sudo apt-get upgrade

# Can't go without it
sudo apt-get install vim

# For debugging the SQLite database
sudo apt-get install sqlite3
```

Add the following to `/boot/firmware/config.txt` to enable charging the real-time clock battery (if applicable):

```
dtparam=rtc_bbat_vchg=3000000
```

In the Raspberry Pi Configuration, set up the following:

- Set the hostname to `attendance-kiosk`
- Set the locale to `en_US.UTF-8`
- Set the timezone to `America/New_York`
- Set the keyboard layout to `Generic 104-key PC` with `English (US)`
- Set the Wi-Fi country to `US`

Install the attendance kiosk package:

```bash
sudo dpkg -i attendance-kiosk_1.0.0_arm64.deb
```

Add the following to `~/.config/wayfire.ini` to autostart the attendance kiosk on boot:

```ini
[autostart]
kiosk = attendance-kiosk --kiosk
```

Then reboot the Raspberry Pi for everything to take effect.
