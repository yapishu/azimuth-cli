#!/bin/bash

# note that you need to use solaris branch

date
set -x
p=$1
mkdir -p output
ticket=$(curl -s -H "Admin-Token: $SOLARIS_ADMIN_TOKEN" https://tlon.network/v1/ships/${p}/master-ticket | jq -r .ticket)
life=$(azimuth-cli get details ${p} | grep life | sed 's/network keys revision (life): //')
# don't use breach flag since we want to preserve keys
azimuth-cli generate network-key --point ${p} --private-key-ticket="~${ticket}" --breach
# breach without wallet
azimuth-cli modify-l2 network-key --breach --private-key-ticket="~${ticket}" --points ${p} --address $(azimuth-cli get details ${p}|grep "owner"|sed 's/owner address: //')
if [ ! -e "./${p}-receipt-L2-configureKeys.json" ]; then
  echo "${p}" >> failed
  rm ${p}*
else
  mkdir -p output/${p}
  mv "${p}-receipt-L2-configureKeys.json" "${p}-networkkeys-${life}.json" "${p}-${life}.key" "output/${p}/"
fi
