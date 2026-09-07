# NEARVIA Database Backup & Disaster Recovery Strategy

## 1. Backup Strategy Overview
The NEARVIA data store is PostgreSQL 15+ with PostGIS spatial extensions. Data durability is maintained through automated snapshotting and continuous write-ahead logging (WAL).

---

## 2. Backup Schedules

| Backup Type | Frequency | Retention Period | Storage Target |
| :--- | :--- | :--- | :--- |
| **Point-in-Time (WAL)** | Continuous (<5 min RPO) | 7 to 30 days | Encrypted Object Storage (S3/GCS) |
| **Daily Full Logical Dump** | Every 24 hours (02:00 UTC) | 30 days | Geographically Redundant Storage |
| **Weekly Archive** | Sunday 03:00 UTC | 90 days | Cold Archive |

---

## 3. Disaster Recovery Procedures

### 3.1 Logical Backup Generation (`pg_dump`)
```bash
# Export compressed binary schema and data dump
pg_dump -Fc -v -d "$DATABASE_URL" -f "nearvia_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 3.2 Restoration from Backup
```bash
# 1. Terminate active application connections
# 2. Restore schema and data
pg_restore -v --clean --if-exists -d "$DATABASE_URL" "nearvia_backup_<TIMESTAMP>.dump"

# 3. Verify spatial and constraint integrity
psql -d "$DATABASE_URL" -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM work_opportunities;"
```

---

## 4. Recovery Objectives
* **Recovery Point Objective (RPO)**: $\le 5\text{ minutes}$ (continuous WAL archiving).
* **Recovery Time Objective (RTO)**: $\le 30\text{ minutes}$ (automated snapshot restoration).
