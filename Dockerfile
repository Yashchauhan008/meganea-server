FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN mkdir -p logs

COPY . .

EXPOSE 5500

CMD ["npm", "run", "start"]
