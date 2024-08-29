# Run like: docker run -v $(pwd):/app/output azimuth-cli generate network-key --point sitful-hatred
FROM node:14.17.4-buster-slim
RUN apt-get update && apt-get install -y git python3 make gcc g++
WORKDIR /app/output
COPY . /app/
RUN npm install
RUN ln -s /app/cli.js /usr/bin/azi
CMD ["node", "cli.js"]

