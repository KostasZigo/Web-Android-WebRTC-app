FROM node:14
WORKDIR /server
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD [ "yarn", "start" ]