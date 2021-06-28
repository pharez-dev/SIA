#!/bin/bash
set -e
user="admindev"

ssh $user@$HOST "mv ~/server/dbBackups ~/dbBackups  && mv ~/server/log ~/log && mv ~/server/public ~/public && mv ~/server/keys ~/keys"
echo "Moved files"
ssh $user@$HOST "pm2 kill"
ssh $user@$HOST "cd ~/server/ && git add . && git commit -m 'stage' "
echo "committed changes"
rm -rf .git
rm -rf .gitignore
git config --global user.email "kchirchir.dev@gmail.com"
git config --global user.name "Ken Chir"
git init .
git add .
git commit -m "Deploying"

git remote add production ssh://$user@$HOST/~/server
git push --force production master

ssh $user@$HOST "cd ~/server && \
cp ../.env ./.env

node gcpSetup.js
pm2 start /home/admindev/server/ecosystem.config.js --env production
pm2 start  /home/admindev/client/ecosystem.config.js --env production
exit"
ssh $user@$HOST "rsync -a ~/dbBackups ~/server/  && rsync -a ~/log ~/server/ && rsync -a ~/public ~/server/ && rsync -a ~/keys ~/server/"
ssh $user@$HOST "rm -rf ~/dbBackups && rm -rf ~/log && rm -rf ~/public && rm -rf ~/keys"