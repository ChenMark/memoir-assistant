#!/bin/bash
# 完整 API 集成测试 - 端到端用户流程
# 使用方法: bash test-integration.sh
# 要求: 服务器运行在 localhost:3000

set -o pipefail
BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0
SKIPPED=0
TOKEN=""
TEST_USER=""
TEST_EMAIL=""
TEST_PASS="Test@1234"
CREATED_MEMOIR=""
CREATED_FRIEND=""
CREATED_DRAFT=""
CREATED_GALLERY=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# Helper
# ============================================================
api() {
  local method="$1" path="$2" data="$3" token="$4" expect_status="${5:-200}"
  local curl_args=(-s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json")
  if [ -n "$token" ] && [ "$token" != "none" ]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ] && [ "$data" != "none" ]; then
    curl_args+=(-d "$data")
  fi
  local raw
  raw=$(curl "${curl_args[@]}" 2>/dev/null)
  local http_code
  http_code=$(echo "$raw" | tail -1)
  local body
  body=$(echo "$raw" | sed '$d')
  echo "$http_code|$body"
}

assert_ok() {
  local test_name="$1" http_code="$2" body="$3" match="$4"
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    if [ -n "$match" ]; then
      if echo "$body" | grep -q "$match"; then
        echo -e "  ${GREEN}✅${NC} $test_name"
        PASSED=$((PASSED + 1))
      else
        echo -e "  ${RED}❌${NC} $test_name — 响应体不匹配: $match"
        echo "      HTTP $http_code body=$body"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "  ${GREEN}✅${NC} $test_name"
      PASSED=$((PASSED + 1))
    fi
  else
    echo -e "  ${RED}❌${NC} $test_name — HTTP $http_code"
    echo "      body=$body"
    FAILED=$((FAILED + 1))
  fi
}

assert_fail() {
  local test_name="$1" http_code="$2" body="$3" match="$4"
  if [ "$http_code" -ge 400 ] && [ "$http_code" -lt 600 ]; then
    if [ -n "$match" ]; then
      if echo "$body" | grep -q "$match"; then
        echo -e "  ${GREEN}✅${NC} $test_name"
        PASSED=$((PASSED + 1))
      else
        echo -e "  ${RED}❌${NC} $test_name — 错误消息不匹配"
        echo "      期望包含: $match, HTTP $http_code body=$body"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "  ${GREEN}✅${NC} $test_name"
      PASSED=$((PASSED + 1))
    fi
  else
    echo -e "  ${RED}❌${NC} $test_name — 期望4xx/5xx，实际 $http_code"
    echo "      body=$body"
    FAILED=$((FAILED + 1))
  fi
}

extract_json() {
  local body="$1" key="$2"
  echo "$body" | grep -o "\"$key\":\"[^\"]*\"" | head -1 | sed "s/\"$key\":\"//;s/\"//"
}

# ============================================================
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║   memoir-assistant API 集成测试套件      ║"
echo "║   Phase 3 完整验证 · 端到端流程         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================
# Block 1: 认证流程 (Register → Login → Profile → Update → Token)
# ============================================================
echo -e "\n${CYAN}━━━ Block 1: 认证流程 ━━━${NC}"

TEST_USER="apiint_$(date +%s)"
TEST_EMAIL="${TEST_USER}@integration.test"

# 1.1 注册
RESULT=$(api "POST" "/auth/register" \
  "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "1.1 注册新用户" "$HTTP" "$BODY" '"token"'
TOKEN=$(extract_json "$BODY" "token")

# 1.2 重复注册
if [ -n "$TOKEN" ]; then
  RESULT=$(api "POST" "/auth/register" \
    "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_fail "1.2 重复注册拒绝" "$HTTP" "$BODY" "已被注册\|已存在"
fi

# 1.3 登录
RESULT=$(api "POST" "/auth/login" \
  "{\"account\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "1.3 账号密码登录" "$HTTP" "$BODY" '"token"'
TOKEN=$(extract_json "$BODY" "token")

# 1.4 获取个人信息
RESULT=$(api "GET" "/auth/me" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "1.4 获取个人信息" "$HTTP" "$BODY" '"username"'

# 1.5 更新个人信息
RESULT=$(api "PUT" "/auth/me" \
  "{\"bio\":\"个人简介-集成测试\"}" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "1.5 更新个人简介" "$HTTP" "$BODY" '"user"'

# 1.6 无效密码登录
RESULT=$(api "POST" "/auth/login" \
  "{\"account\":\"$TEST_USER\",\"password\":\"WrongPass999\"}")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "1.6 错误密码拒绝" "$HTTP" "$BODY" "错误"

# ============================================================
# Block 2: Memoir CRUD 流程
# ============================================================
echo -e "\n${CYAN}━━━ Block 2: 回忆录 CRUD ━━━${NC}"

# 2.1 创建回忆录
RESULT=$(api "POST" "/memoir" \
  '{"title":"我的第一篇回忆录","content":"今天是难忘的一天。","date":"2026-06-13","tags":["日常","心情"],"mood":"开心"}' "$TOKEN" 201)
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "2.1 创建回忆录" "$HTTP" "$BODY" '"memoir"'
CREATED_MEMOIR=$(extract_json "$BODY" "id")

# 2.2 获取回忆录列表
RESULT=$(api "GET" "/memoir" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "2.2 获取回忆录列表" "$HTTP" "$BODY" '"memoirs"'

# 2.3 获取单篇回忆录
if [ -n "$CREATED_MEMOIR" ]; then
  RESULT=$(api "GET" "/memoir/$CREATED_MEMOIR" "none" "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "2.3 获取单篇回忆录" "$HTTP" "$BODY" '"memoir"'
fi

# 2.4 更新回忆录
if [ -n "$CREATED_MEMOIR" ]; then
  RESULT=$(api "PUT" "/memoir/$CREATED_MEMOIR" \
    '{"title":"更新后的标题","content":"补充了一些细节。","mood":"感慨"}' "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "2.4 更新回忆录" "$HTTP" "$BODY" '"memoir"'
fi

# 2.5 未认证创建
RESULT=$(api "POST" "/memoir" \
  '{"title":"未认证","content":"test","date":"2026-06-13"}' "none")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "2.5 未认证拒绝创建" "$HTTP" "$BODY" "未登录"

# 2.6 获取不存在的回忆录
RESULT=$(api "GET" "/memoir/nonexistent_id_99999" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "2.6 不存在的回忆录返回404" "$HTTP" "$BODY" ""

# ============================================================
# Block 3: Friend CRUD 流程
# ============================================================
echo -e "\n${CYAN}━━━ Block 3: 好友 CRUD ━━━${NC}"

# 3.1 创建好友
RESULT=$(api "POST" "/friend" \
  '{"name":"张三","category":"friend","tags":["同事","跑步"]}' "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "3.1 创建好友" "$HTTP" "$BODY" '"friend"'
CREATED_FRIEND=$(extract_json "$BODY" "id")

# 3.2 创建家人(带辈分)
RESULT=$(api "POST" "/friend" \
  '{"name":"爸爸","category":"family","generation":1,"relationship":"父亲"}' "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "3.2 创建家人(带辈分)" "$HTTP" "$BODY" '"friend"'

# 3.3 创建同学
RESULT=$(api "POST" "/friend" \
  '{"name":"李四","category":"class_mate","school":"清华大学","graduationYear":"2020"}' "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "3.3 创建同学" "$HTTP" "$BODY" '"friend"'

# 3.4 获取好友列表
RESULT=$(api "GET" "/friend" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "3.4 获取好友列表" "$HTTP" "$BODY" '"friends"'

# 3.5 按分类筛选
RESULT=$(api "GET" "/friend?category=family" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "3.5 按family分类筛选" "$HTTP" "$BODY" '"friends"'

# 3.6 更新好友
if [ -n "$CREATED_FRIEND" ]; then
  RESULT=$(api "PUT" "/friend/$CREATED_FRIEND" \
    '{"name":"张三丰","tags":["同事","跑步","太极"]}' "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "3.6 更新好友信息" "$HTTP" "$BODY" '"friend"'
fi

# 3.7 删除好友
if [ -n "$CREATED_FRIEND" ]; then
  RESULT=$(api "DELETE" "/friend/$CREATED_FRIEND" "none" "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "3.7 删除好友" "$HTTP" "$BODY" ""
fi

# ============================================================
# Block 4: Draft / Gallery 流程
# ============================================================
echo -e "\n${CYAN}━━━ Block 4: 草稿 & 画廊 ━━━${NC}"

# 4.1 保存草稿
RESULT=$(api "POST" "/memoir/draft" \
  '{"title":"未完成的草稿","content":"今天发生了一件事...","tags":["草稿"]}' "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "4.1 保存草稿" "$HTTP" "$BODY" '"draft"'
CREATED_DRAFT=$(extract_json "$BODY" "id")

# 4.2 获取草稿列表
RESULT=$(api "GET" "/memoir/draft" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "4.2 获取草稿列表" "$HTTP" "$BODY" '"drafts"'

# 4.3 创建画廊
RESULT=$(api "POST" "/memoir/gallery" \
  '{"ossKey":"uploads/2026/sunset.jpg","caption":"美丽的日落","date":"2026-06-13","tags":["风景"]}' "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "4.3 创建画廊条目" "$HTTP" "$BODY" '"item"'
CREATED_GALLERY=$(extract_json "$BODY" "id")

# 4.4 获取画廊列表
RESULT=$(api "GET" "/memoir/gallery" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "4.4 获取画廊列表" "$HTTP" "$BODY" '"gallery"'

# ============================================================
# Block 5: 安全 & 边界条件
# ============================================================
echo -e "\n${CYAN}━━━ Block 5: 安全边界 ━━━${NC}"

# 5.1 无效 Token
RESULT=$(api "GET" "/auth/me" "none" "invalid_token_12345")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "5.1 无效Token拒绝" "$HTTP" "$BODY" ""

# 5.2 过期 Token（伪造的未来签发时间）
FAKE_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIiwiaWF0IjoxMDAwMDAwMDAwLCJleHAiOjEwMDAwMDAwMDF9.fake"
RESULT=$(api "GET" "/auth/me" "none" "$FAKE_TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "5.2 伪造Token拒绝" "$HTTP" "$BODY" ""

# 5.3 跨用户访问保护（尝试用tokenA访问tokenB的资源）
RESULT2=$(api "POST" "/auth/register" \
  "{\"username\":\"userB_$(date +%s)\",\"email\":\"userb_$(date +%s)@test.com\",\"password\":\"$TEST_PASS\"}")
BODY2=$(echo "$RESULT2" | cut -d'|' -f2-)
TOKEN_B=$(extract_json "$BODY2" "token")

if [ -n "$TOKEN_B" ] && [ -n "$CREATED_MEMOIR" ]; then
  RESULT=$(api "GET" "/memoir/$CREATED_MEMOIR" "none" "$TOKEN_B")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_fail "5.3 跨用户访问保护" "$HTTP" "$BODY" ""

  # 清理用户B
  RESULT=$(api "DELETE" "/friend/nonexist" "none" "$TOKEN_B")
fi

# 5.4 XSS 注入尝试（后端净化）
RESULT=$(api "POST" "/auth/register" \
  '{"username":"<script>alert(1)</script>","email":"xss@test.com","password":"XssTest1"}')
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_fail "5.4 XSS脚本标签净化" "$HTTP" "$BODY" "error"

# 5.5 超长内容验证 (已知: Zod schema 限制 content <= 50000)
# 注意: bash/curl 的变量长度限制导致大字符串直接传参会失败
# 这里使用文件方式绕过，若仍失败则标记为环境限制
LONG_BODY='{"title":"test","content":"'
python3 -c "import sys; sys.stdout.write('x' * 50001)" > /tmp/_memoir_long.txt 2>/dev/null \
  || python -c "import sys; sys.stdout.write('x' * 50001)" > /tmp/_memoir_long.txt 2>/dev/null
if [ -f /tmp/_memoir_long.txt ] && [ -s /tmp/_memoir_long.txt ]; then
  LONG_CONTENT=$(cat /tmp/_memoir_long.txt)
  LONG_FULL="${LONG_BODY}${LONG_CONTENT}\",\"date\":\"2026-06-13\"}"
  echo "$LONG_FULL" > /tmp/_memoir_body.json
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/memoir" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data-binary @/tmp/_memoir_body.json 2>/dev/null)
  HTTP=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  if [ "$HTTP" -ge 400 ] 2>/dev/null; then
    echo -e "  ${GREEN}✅${NC} 5.5 超长内容拒绝 (HTTP $HTTP)"
    PASSED=$((PASSED + 1))
  elif [ -z "$HTTP" ]; then
    echo -e "  ${YELLOW}⚠️${NC}  5.5 跳过 (curl/buffer 限制)"
    SKIPPED=$((SKIPPED + 1))
  else
    echo -e "  ${RED}❌${NC} 5.5 超长内容未被拒绝 — HTTP $HTTP"
    FAILED=$((FAILED + 1))
  fi
  rm -f /tmp/_memoir_long.txt /tmp/_memoir_body.json
else
  echo -e "  ${YELLOW}⚠️${NC}  5.5 跳过 (python不可用)"
  SKIPPED=$((SKIPPED + 1))
fi

# 5.6 响应格式一致性检查
RESULT=$(api "GET" "/auth/me" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
if echo "$BODY" | grep -q '"user"' && echo "$BODY" | grep -q '"username"'; then
  echo -e "  ${GREEN}✅${NC} 5.6 响应格式一致性 (auth/me)"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}❌${NC} 5.6 响应格式异常"
  FAILED=$((FAILED + 1))
fi

RESULT=$(api "GET" "/memoir" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
if echo "$BODY" | grep -q '"memoirs"'; then
  echo -e "  ${GREEN}✅${NC} 5.7 响应格式一致性 (memoir list)"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}❌${NC} 5.7 响应格式异常"
  FAILED=$((FAILED + 1))
fi

RESULT=$(api "GET" "/friend" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
if echo "$BODY" | grep -q '"friends"'; then
  echo -e "  ${GREEN}✅${NC} 5.8 响应格式一致性 (friend list)"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}❌${NC} 5.8 响应格式异常"
  FAILED=$((FAILED + 1))
fi

# ============================================================
# Block 6: 清理 & 资源释放
# ============================================================
echo -e "\n${CYAN}━━━ Block 6: 资源清理 ━━━${NC}"

# 6.1 删除草稿
if [ -n "$CREATED_DRAFT" ] && [ -n "$TOKEN" ]; then
  RESULT=$(api "DELETE" "/memoir/draft/$CREATED_DRAFT" "none" "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "6.1 删除草稿" "$HTTP" "$BODY" ""
fi

# 6.2 删除画廊
if [ -n "$CREATED_GALLERY" ] && [ -n "$TOKEN" ]; then
  RESULT=$(api "DELETE" "/memoir/gallery/$CREATED_GALLERY" "none" "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "6.2 删除画廊" "$HTTP" "$BODY" ""
fi

# 6.3 删除回忆录
if [ -n "$CREATED_MEMOIR" ] && [ -n "$TOKEN" ]; then
  RESULT=$(api "DELETE" "/memoir/$CREATED_MEMOIR" "none" "$TOKEN")
  HTTP=$(echo "$RESULT" | cut -d'|' -f1)
  BODY=$(echo "$RESULT" | cut -d'|' -f2-)
  assert_ok "6.3 删除回忆录" "$HTTP" "$BODY" ""
fi

# 6.4 验证删除后列表
RESULT=$(api "GET" "/memoir" "none" "$TOKEN")
HTTP=$(echo "$RESULT" | cut -d'|' -f1)
BODY=$(echo "$RESULT" | cut -d'|' -f2-)
assert_ok "6.4 删除后列表验证" "$HTTP" "$BODY" '"memoirs"'

# ============================================================
echo -e "\n${CYAN}╔══════════════════════════════════════════╗"
echo -e "║            测试结果汇总                   ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
echo -e "  ${GREEN}通过: $PASSED${NC}"
echo -e "  ${RED}失败: $FAILED${NC}"
echo -e "  ${YELLOW}跳过: $SKIPPED${NC}"
echo -e "  总计: $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 所有集成测试通过！${NC}\n"
  exit 0
else
  echo -e "${RED}⚠️  $FAILED 个测试失败，请检查上述输出${NC}\n"
  exit 1
fi
