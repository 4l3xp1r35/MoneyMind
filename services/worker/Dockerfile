FROM node:20-alpine
WORKDIR /app
COPY services/worker/package.json ./
RUN npm install
# Copy root prisma schema so we can generate the client
COPY prisma ./prisma
RUN npx prisma generate
COPY services/worker/src ./src
COPY services/worker/tsconfig.json ./
CMD ["npm", "start"]
