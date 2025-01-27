#/bin/bash
set -o errexit

if [ ! -f /.dockerenv ]; then
    >&2 echo "This should be run inside Docker! See README for details."
    exit 1
fi

cp -a /code/. .
rm -rf node_modules .webpack /code/out

apt-get update
apt-get install dpkg fakeroot

npm install
npm run make:pi

mv /code2/out /code
