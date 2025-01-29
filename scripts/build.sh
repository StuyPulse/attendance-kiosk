#/bin/bash
set -o errexit

if [ ! -f /.dockerenv ]; then
    >&2 echo "This should be run inside Docker! See README for details."
    exit 1
fi

rm -rf /code/out
cp -a /code/. .
rm -rf node_modules .webpack

apt-get update
apt-get install dpkg fakeroot

npm install
npm run make:pi

mv /code2/out /code
