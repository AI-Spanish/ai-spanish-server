```
npm install
npm run dev
```

```
open http://localhost:8000
```

Uses:

- [Hono](https://hono.dev/) as the API framework
- [Drizzle](https://orm.drizzle.team/) as the ORM
- [Postgres](https://www.postgresql.org/) as the database
- [Lucia](https://lucia-auth.com/) and [Oslo](https://oslo.js.org/) for auth
- [React Email](https://react.email/) for the email templates

## 接口更新

```bash
node src/test.js
```

## 数据库

```bash
# run pg use docker
docker run --name spanish-postgres -e POSTGRES_PASSWORD=123456 -p 5432:5432  -d postgres

# npx drizzle-kit push
yarn db:push
# 运行种子数据脚本
# npx tsx src/db/seed.ts
yarn db:seed
```

## Deploy

```bash
# 删除
docker stop spanish-server
docker rm spanish-server
docker rmi spanish-server

docker build -t spanish-server .

docker run -p 8000:8000  --env-file .env.prod --name spanish-server spanish-server

# 持久化
docker volume create spanish-volume


docker run -p 8000:8000  --env-file .env.prod --name spanish-server -v spanish-volume:/root/workspace/spanish-volume spanish-server



# 进入容器
docker exec -it spanish-server /bin/sh
# 将文件从容器复制到宿主机
docker cp spanish-server:/app/logs /root/workspace/


# 备份数据库
docker exec -it spanish-postgres /bin/sh
pg_dump -U postgres -h 118.31.74.178 -p 5432 spanish-PROD > spanish-PROD.sql
docker cp spanish-postgres:spanish-PROD.sql /root/workspace/ai-spanish-database/spanish-PROD.sql

```

**宝塔**

```bash
# 查看登录信息
/etc/init.d/bt default
```

## 代码文档

```bash
pyerz -i ai-spanish-mini \
    -i ai-spanish-server \
    -t 生成式人工智能支持的智能西语语伴软件V1.0 \
    -e py -e html -e js \
    --exclude ai-spanish-mini/node_modules \
    --exclude ai-spanish-mini/miniprogram_npm \
    --exclude ai-spanish-server/node_modules \
    --exclude ai-spanish-server/dist \
    -o ai-spanish代码文档.docx \
    -v
```
