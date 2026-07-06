FROM node:20-alpine
ENV TZ="Asia/Shanghai"
ENV HUSKY=0

RUN apk add --no-cache python3 make g++

WORKDIR /yapi/vendors

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/yapi/vendors/docker/start.sh"]
