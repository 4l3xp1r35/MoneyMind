FROM node:20-alpine
WORKDIR /app
COPY services/prices/package.json ./
RUN npm install
COPY services/prices/src ./src
COPY services/prices/tsconfig.json ./
EXPOSE 3001
CMD ["npm", "start"]
