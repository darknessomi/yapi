FROM node:18-alpine
ENV TZ="Asia/Shanghai"
# 使用阿里云镜像
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
WORKDIR /yapi/vendors
COPY . /yapi/vendors/

RUN apk add --no-cache wget python3 make g++ && cd /yapi/vendors && npm install --production --registry https://registry.npmmirror.com

EXPOSE 3000
ENTRYPOINT ["node"]
