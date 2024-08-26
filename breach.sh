#!/bin/bash
set -x
p=$1
ticket=$2
# increment the rift so it matches what /Users/reid/gits/tlon/azimuth-cli/cli.js expects
rift=$(/Users/reid/gits/tlon/azimuth-cli/cli.js get details ${p} | grep rift | sed 's/continuity number (rift): //')
/Users/reid/gits/tlon/azimuth-cli/cli.js generate network-key --point ${p}
find . -type f \( -name "${p}-0.key" -o -name "${p}-networkkeys-0.json" \) | while read -r file; do
  basename=$(basename "$file")
  num="${basename##*-}"
  ext="${num##*.}"
  n=$rift
  if [[ "$ext" == "json" ]]; then
    new="${p}-networkkeys-${n}.json"
  else
    new="${p}-${n}.key"
  fi
  mv "$file" "./$new"
done
# breach without wallet
/Users/reid/gits/tlon/azimuth-cli/cli.js modify-l2 network-key --breach --private-key-ticket="~${ticket}" --points ${p} --address $(/Users/reid/gits/tlon/azimuth-cli/cli.js get details ${p}|grep "owner"|sed 's/owner address: '//) --
if [ ! -e "./${p}-receipt-L2-configureKeys.json" ]; then
  echo "${p}" >> failed
  rm ${p}*
else
  # increment the rift number in the file to reflect breach
  mkdir -p ${p} 
  find . -type f \( -name "${p}-0.key" -o -name "${p}-networkkeys-0.json" \) | while read -r file; do
    basename=$(basename "$file")
    num="${basename##*-}"
    ext="${num##*.}"
    n="$(($rift + 1))"
    if [[ "$ext" == "json" ]]; then
      new="${p}-networkkeys-${n}.json"
    else
      new="${p}-${n}.key"
    fi
    # put it in its dir
    mv "$file" "${p}/$new"
  done
fi
