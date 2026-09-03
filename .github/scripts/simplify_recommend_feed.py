from pathlib import Path
import re

path = Path('express-project/routes/posts.js')
text = path.read_text(encoding='utf-8')

query_pattern = re.compile(
    r"    // 特殊处理推荐频道：热度新鲜度评分前20%的笔记按分数排序\n"
    r"    if \(category === 'recommend'\) \{.*?"
    r"    const \[rows\] = await pool\.execute\(query, queryParams\);",
    re.S,
)

query_replacement = """    // 推荐频道 = 全部分类的已发布内容，按发布时间倒序；其他频道按分类筛选
    let whereConditions = [];
    let additionalParams = [];

    if (category && category !== 'recommend') {
      whereConditions.push('p.category_id = ?');
      additionalParams.push(category);
    }

    if (userId) {
      whereConditions.push('p.user_id = ?');
      additionalParams.push(userId);
    }

    if (type) {
      whereConditions.push('p.type = ?');
      additionalParams.push(type);
    }

    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    queryParams = [status.toString(), ...additionalParams, limit.toString(), offset.toString()];

    const [rows] = await pool.execute(query, queryParams);"""

text, query_count = query_pattern.subn(query_replacement, text, count=1)
if query_count != 1:
    raise SystemExit(f'Expected to replace one recommend query block, replaced {query_count}')

count_pattern = re.compile(
    r"    // 获取总数\n"
    r"    let total;\n"
    r"    if \(category === 'recommend'\) \{.*?"
    r"    \}\n\n"
    r"    res\.json\(\{",
    re.S,
)

count_replacement = """    // 获取总数；推荐频道统计全部分类，其他频道按分类统计
    let countQuery = 'SELECT COUNT(*) as total FROM posts p WHERE p.status = ?';
    let countParams = [status.toString()];
    const countWhereConditions = [];

    if (category && category !== 'recommend') {
      countWhereConditions.push('p.category_id = ?');
      countParams.push(category);
    }

    if (userId) {
      countWhereConditions.push('p.user_id = ?');
      countParams.push(userId);
    }

    if (type) {
      countWhereConditions.push('p.type = ?');
      countParams.push(type);
    }

    if (countWhereConditions.length > 0) {
      countQuery += ` AND ${countWhereConditions.join(' AND ')}`;
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({"""

text, count_count = count_pattern.subn(count_replacement, text, count=1)
if count_count != 1:
    raise SystemExit(f'Expected to replace one recommend count block, replaced {count_count}')

path.write_text(text, encoding='utf-8')
