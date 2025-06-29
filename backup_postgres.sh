#!/bin/bash
# 配置参数
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="spanish-postgres"
DB_USER="postgres"
DB_NAME="spanish_prod"  # 指定要备份的数据库
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "$DATE: 错误 - 容器 $CONTAINER_NAME 未运行" >> $BACKUP_DIR/backup.log
    exit 1
fi

# 检查数据库是否存在
if ! docker exec $CONTAINER_NAME psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "$DATE: 错误 - 数据库 $DB_NAME 不存在" >> $BACKUP_DIR/backup.log
    exit 1
fi

# 执行备份 - 只备份指定数据库
echo "$DATE: 开始备份数据库 $DB_NAME..." >> $BACKUP_DIR/backup.log
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d "$DB_NAME" | gzip > $BACKUP_DIR/pg_backup_${DB_NAME}_$DATE.sql.gz

# 验证备份完整性
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    BACKUP_SIZE=$(du -h $BACKUP_DIR/pg_backup_${DB_NAME}_$DATE.sql.gz | cut -f1)
    echo "$DATE: 备份成功 - $DB_NAME (大小: $BACKUP_SIZE)" >> $BACKUP_DIR/backup.log
    # 清理旧备份
    find $BACKUP_DIR -name "pg_backup_${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "$DATE: 清理完成 - 保留最近 $RETENTION_DAYS 天的备份" >> $BACKUP_DIR/backup.log
else
    echo "$DATE: 备份失败 - $DB_NAME" >> $BACKUP_DIR/backup.log
    exit 1
fi