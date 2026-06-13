FROM node:20-alpine
ENV TZ="Asia/Shanghai"
# 使用阿里云镜像
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 编译 native 模块依赖，单独一层便于缓存
RUN apk add --no-cache python3 make g++

WORKDIR /yapi/vendors

COPY package.json package-lock.json .npmrc ./
RUN npm install --omit=dev --registry https://registry.npmmirror.com

COPY . .

EXPOSE 3000
ENTRYPOINT ["node"]
