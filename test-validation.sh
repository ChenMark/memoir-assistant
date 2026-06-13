#!/bin/bash
# 完整API验证测试脚本 - Zod验证 + memoir/friend端点
# 使用方法: bash test-validation.sh

BASE_URL="http://localhost:3000"
FAILED=0
PASSED=0
TOKEN=""
TEST_USER="zodtest_$(date +%s)"
TEST_EMAIL="${TEST_USER}@test.com"
TEST_PASS="Test123456"

# ---------- helper ----------
run_test() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expect="$5"
  local auth="$6"

  echo "测试: $name"
  if [ -n "$auth" ]; then
    RESPONSE=$(curl -s -X "$method" "$BASE_URL$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $auth" \
      -d "$data")
  else
    RESPONSE=$(curl -s -X "$method" "$BASE_URL$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  if echo "$RESPONSE" | grep -q "$expect"; then
    echo "  ✅ 通过 - 匹配: '$expect'"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ 失败 - 期望包含 '$expect'"
    echo "     响应: $RESPONSE"
    FAILED=$((FAILED + 1))
  fi
}

# ================================================================
echo "🧪 完整 Zod 验证测试 (Phase 3)"
echo "================================"
echo ""

# ========================================
# Part A: 无需认证的 Auth 验证
# ========================================
echo "--- A. Auth 模块验证 ---"

run_test "A1 - register 缺少username" \
  "POST" "/auth/register" \
  '{"email":"a@b.com","password":"123456"}' \
  "error"

run_test "A2 - register email格式无效" \
  "POST" "/auth/register" \
  '{"username":"test","email":"bad","password":"123456"}' \
  "邮箱格式不正确"

run_test "A3 - login 密码为空" \
  "POST" "/auth/login" \
  '{"account":"test","password":""}' \
  "密码不能为空"

run_test "A4 - login 账号为空" \
  "POST" "/auth/login" \
  '{"account":"","password":"123456"}' \
  "账号不能为空"

run_test "A5 - send-sms 手机号无效" \
  "POST" "/auth/send-sms" \
  '{"phone":"12345"}' \
  "手机号格式不正确"

run_test "A6 - send-sms 手机号有效(格式正确)" \
  "POST" "/auth/send-sms" \
  '{"phone":"13800138000"}' \
  "验证码"

echo ""

# ========================================
# Part B: 注册测试用户，获取 Token
# ========================================
echo "--- B. 准备认证 Token ---"
REG_RESP=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
echo "  注册响应: $REG_RESP"

TOKEN=$(echo "$REG_RESP" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
if [ -z "$TOKEN" ]; then
  echo "  ⚠️ 注册未获取到 token，尝试登录..."
  LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"account\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
  echo "  登录响应: $LOGIN_RESP"
  TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
fi

if [ -z "$TOKEN" ]; then
  echo "  ❌ 无法获取 Token，后续认证测试将跳过"
else
  echo "  ✅ Token 获取成功"
fi
echo ""

# ========================================
# Part C: Memoir 模块验证 (需认证)
# ========================================
echo "--- C. Memoir 模块验证 ---"

run_test "C1 - POST /memoir 未认证" \
  "POST" "/memoir" \
  '{"title":"test","content":"hello","date":"2026-06-13","tags":[]}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "C2 - create memoir 缺少标题" \
    "POST" "/memoir" \
    '{"content":"hello","date":"2026-06-13","tags":[]}' \
    "标题不能为空" \
    "$TOKEN"

  run_test "C3 - create memoir 日期格式错误" \
    "POST" "/memoir" \
    '{"title":"test","content":"hello","date":"06/13/2026","tags":[]}' \
    "日期格式" \
    "$TOKEN"

  run_test "C4 - create memoir 标题超长(>200)" \
    "POST" "/memoir" \
    "{\"title\":\"$(printf 'x%.0s' $(seq 1 250))\",\"content\":\"ok\",\"date\":\"2026-06-13\",\"tags\":[]}" \
    "最多200" \
    "$TOKEN"

  run_test "C5 - create memoir 标签超量(>20)" \
    "POST" "/memoir" \
    "{\"title\":\"test\",\"content\":\"ok\",\"date\":\"2026-06-13\",\"tags\":[$(for i in $(seq 1 25); do printf '"tag%d",' $i; done | sed 's/,$//')]}" \
    "最多20" \
    "$TOKEN"

  run_test "C6 - create memoir 正常创建" \
    "POST" "/memoir" \
    '{"title":"测试回忆录","content":"今天天气不错","date":"2026-06-13","tags":["日常","心情"],"mood":"开心"}' \
    '"memoir"' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part D: Friend 模块验证 (需认证)
# ========================================
echo "--- D. Friend 模块验证 ---"

run_test "D1 - POST /friend 未认证" \
  "POST" "/friend" \
  '{"name":"张三","category":"friend"}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "D2 - create friend 缺少姓名" \
    "POST" "/friend" \
    '{"category":"friend"}' \
    "姓名不能为空" \
    "$TOKEN"

  run_test "D3 - create friend 无效分类" \
    "POST" "/friend" \
    '{"name":"李四","category":"colleague"}' \
    "error" \
    "$TOKEN"

  run_test "D4 - create friend 辈分超出范围" \
    "POST" "/friend" \
    '{"name":"王五","category":"family","generation":15}' \
    "辈分最大为10" \
    "$TOKEN"

  run_test "D5 - create friend 毕业年份格式错误" \
    "POST" "/friend" \
    '{"name":"同学A","category":"class_mate","graduationYear":"二〇二〇"}' \
    "毕业年份" \
    "$TOKEN"

  run_test "D6 - create friend 正常创建" \
    "POST" "/friend" \
    '{"name":"测试好友","category":"friend"}' \
    '"friend"' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part E: Draft / Gallery 验证 (需认证)
# ========================================
echo "--- E. Draft & Gallery 模块验证 ---"

if [ -n "$TOKEN" ]; then
  run_test "E1 - save draft 标题超长" \
    "POST" "/memoir/draft" \
    "{\"title\":\"$(printf 'x%.0s' $(seq 1 250))\",\"content\":\"draft content\"}" \
    "最多200" \
    "$TOKEN"

  run_test "E2 - save draft 正常保存" \
    "POST" "/memoir/draft" \
    '{"title":"草稿测试","content":"这是草稿内容","tags":["草稿"]}' \
    '"draft"' \
    "$TOKEN"

  run_test "E3 - create gallery 缺少图片地址" \
    "POST" "/memoir/gallery" \
    '{"caption":"测试图片","date":"2026-06-13"}' \
    "图片地址" \
    "$TOKEN"

  run_test "E4 - create gallery 正常创建" \
    "POST" "/memoir/gallery" \
    '{"ossKey":"uploads/2026/test.jpg","caption":"测试图片","date":"2026-06-13","tags":["照片"]}' \
    '"item"' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part F: 边界条件测试
# ========================================
echo "--- F. 边界条件测试 ---"

run_test "F1 - register 用户名过短(<2)" \
  "POST" "/auth/register" \
  '{"username":"a","email":"a@b.com","password":"123456"}' \
  "至少2"

run_test "F2 - register 密码过短(<6)" \
  "POST" "/auth/register" \
  '{"username":"test2","email":"t2@b.com","password":"12345"}' \
  "至少6"

run_test "F3 - phone-login 缺少验证码" \
  "POST" "/auth/phone-login" \
  '{"phone":"13800138000"}' \
  "验证码不能为空"

run_test "F4 - 不存在的路由" \
  "POST" "/auth/nonexistent" \
  '{}' \
  "接口不存在"

# ================================================================
echo "================================"
echo "📊 测试完成: ✅ $PASSED 通过, ❌ $FAILED 失败"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 所有测试通过！"
  exit 0
else
  echo "⚠️  有 $FAILED 个测试失败，请检查上述输出"
  exit 1
fi
