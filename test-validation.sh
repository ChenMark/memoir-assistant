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
  "POST" "/api/v1/auth/register" \
  '{"email":"a@b.com","password":"123456"}' \
  "error"

run_test "A2 - register email格式无效" \
  "POST" "/api/v1/auth/register" \
  '{"username":"test","email":"bad","password":"123456"}' \
  "邮箱格式不正确"

run_test "A3 - login 密码为空" \
  "POST" "/api/v1/auth/login" \
  '{"account":"test","password":""}' \
  "密码不能为空"

run_test "A4 - login 账号为空" \
  "POST" "/api/v1/auth/login" \
  '{"account":"","password":"123456"}' \
  "账号不能为空"

run_test "A5 - send-sms 手机号无效" \
  "POST" "/api/v1/auth/send-sms" \
  '{"phone":"12345"}' \
  "手机号格式不正确"

run_test "A6 - send-sms 手机号有效(格式正确)" \
  "POST" "/api/v1/auth/send-sms" \
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
  "POST" "/api/v1/friend" \
  '{"name":"张三","category":"friend"}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "D2 - create friend 缺少姓名" \
    "POST" "/api/v1/friend" \
    '{"category":"friend"}' \
    "姓名不能为空" \
    "$TOKEN"

  run_test "D3 - create friend 无效分类" \
    "POST" "/api/v1/friend" \
    '{"name":"李四","category":"colleague"}' \
    "error" \
    "$TOKEN"

  run_test "D4 - create friend 辈分超出范围" \
    "POST" "/api/v1/friend" \
    '{"name":"王五","category":"family","generation":15}' \
    "辈分最大为10" \
    "$TOKEN"

  run_test "D5 - create friend 毕业年份格式错误" \
    "POST" "/api/v1/friend" \
    '{"name":"同学A","category":"class_mate","graduationYear":"二〇二〇"}' \
    "毕业年份" \
    "$TOKEN"

  run_test "D6 - create friend 正常创建" \
    "POST" "/api/v1/friend" \
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
    "POST" "/api/v1/memoir/draft" \
    "{\"title\":\"$(printf 'x%.0s' $(seq 1 250))\",\"content\":\"draft content\"}" \
    "最多200" \
    "$TOKEN"

  run_test "E2 - save draft 正常保存" \
    "POST" "/api/v1/memoir/draft" \
    '{"title":"草稿测试","content":"这是草稿内容","tags":["草稿"]}' \
    '"draft"' \
    "$TOKEN"

  run_test "E3 - create gallery 缺少图片地址" \
    "POST" "/api/v1/memoir/gallery" \
    '{"caption":"测试图片","date":"2026-06-13"}' \
    "图片地址" \
    "$TOKEN"

  run_test "E4 - create gallery 正常创建" \
    "POST" "/api/v1/memoir/gallery" \
    '{"ossKey":"uploads/2026/test.jpg","caption":"测试图片","date":"2026-06-13","tags":["照片"]}' \
    '"item"' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part F: OSS 模块验证 (需认证)
# ========================================
echo "--- F. OSS 模块验证 ---"

run_test "F1 - POST /oss/sign 未认证" \
  "POST" "/api/v1/oss/sign" \
  '{"key":"test.jpg"}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "F2 - oss/sign 缺少key" \
    "POST" "/api/v1/oss/sign" \
    '{"contentType":"image/jpeg"}' \
    "文件路径" \
    "$TOKEN"

  run_test "F3 - oss/download 缺少key" \
    "POST" "/api/v1/oss/download" \
    '{}' \
    "文件路径" \
    "$TOKEN"

  run_test "F4 - oss/delete 缺少key" \
    "POST" "/api/v1/oss/delete" \
    '{}' \
    "文件路径" \
    "$TOKEN"

  run_test "F5 - oss/list 缺少prefix" \
    "POST" "/api/v1/oss/list" \
    '{}' \
    "前缀" \
    "$TOKEN"
fi
echo ""

# ========================================
# Part G: AI 模块验证 (需认证)
# ========================================
echo "--- G. AI 模块验证 ---"

run_test "G1 - POST /ai/chat 未认证" \
  "POST" "/api/v1/ai/chat" \
  '{"messages":[{"role":"user","content":"hello"}],"dimensionId":"test"}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "G2 - ai/chat 缺少messages" \
    "POST" "/api/v1/ai/chat" \
    '{"dimensionId":"childhood"}' \
    "messages" \
    "$TOKEN"

  run_test "G3 - ai/chat 缺少dimensionId" \
    "POST" "/api/v1/ai/chat" \
    '{"messages":[{"role":"user","content":"hello"}]}' \
    "dimensionId" \
    "$TOKEN"

  run_test "G4 - ai/chat 空消息数组" \
    "POST" "/api/v1/ai/chat" \
    '{"messages":[],"dimensionId":"childhood"}' \
    "至少需要1条" \
    "$TOKEN"

  run_test "G5 - ai/chat 无效角色" \
    "POST" "/api/v1/ai/chat" \
    '{"messages":[{"role":"bot","content":"hello"}],"dimensionId":"childhood"}' \
    "system/user/assistant" \
    "$TOKEN"

  run_test "G6 - ai/generate-story 空消息" \
    "POST" "/api/v1/ai/generate-story" \
    '{"messages":[]}' \
    "至少需要1条" \
    "$TOKEN"

  run_test "G7 - ai/dimensions 正常请求" \
    "GET" "/api/v1/ai/dimensions" \
    '{}' \
    '"success":true' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part H: 边界条件测试
# ========================================
echo "--- H. 边界条件测试 ---"

run_test "H1 - register 用户名过短(<2)" \
  "POST" "/api/v1/auth/register" \
  '{"username":"a","email":"a@b.com","password":"123456"}' \
  "至少2"

run_test "H2 - register 密码过短(<6)" \
  "POST" "/api/v1/auth/register" \
  '{"username":"test2","email":"t2@b.com","password":"12345"}' \
  "至少6"

run_test "H3 - phone-login 缺少验证码" \
  "POST" "/api/v1/auth/phone-login" \
  '{"phone":"13800138000"}' \
  "验证码不能为空"

run_test "H4 - 不存在的路由" \
  "POST" "/api/v1/auth/nonexistent" \
  '{}' \
  "接口不存在"

# ========================================
# Part I: 爱好模块验证 (需认证)
# ========================================
echo "--- I. 爱好模块验证 ---"

run_test "I1 - GET /hobby 未认证" \
  "GET" "/api/v1/hobby" \
  '{}' \
  "未登录"

if [ -n "$TOKEN" ]; then
  run_test "I2 - 添加金曲" \
    "POST" "/api/v1/hobby" \
    '{"category":"music","title":"Yesterday","year":"1965","rating":5}' \
    '"hobby"' \
    "$TOKEN"

  run_test "I3 - 添加电影" \
    "POST" "/api/v1/hobby" \
    '{"category":"movie","title":"肖申克的救赎","year":"1994","rating":5}' \
    '"hobby"' \
    "$TOKEN"

  run_test "I4 - 无效分类拒绝" \
    "POST" "/api/v1/hobby" \
    '{"category":"invalid","title":"test"}' \
    "分类无效" \
    "$TOKEN"

  run_test "I5 - 缺少标题拒绝" \
    "POST" "/api/v1/hobby" \
    '{"category":"music"}' \
    "不能为空" \
    "$TOKEN"

  run_test "I6 - 按分类获取" \
    "GET" "/api/v1/hobby?category=music" \
    '{}' \
    '"hobbies"' \
    "$TOKEN"

  run_test "I7 - 获取全部爱好" \
    "GET" "/api/v1/hobby" \
    '{}' \
    '"hobbies"' \
    "$TOKEN"
fi
echo ""

# ========================================
# Part J: 画廊交互验证 (评论+分享)
# ========================================
echo "--- J. 画廊交互验证 ---"

if [ -n "$TOKEN" ]; then
  # 先创建一条画廊记录用于测试
  GALLERY_RESP=$(curl -s -X POST "$BASE_URL/memoir/gallery" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"ossKey":"uploads/2026/test-interact.jpg","caption":"测试评论分享","date":"2026-06-13"}')
  GALLERY_ID=$(echo "$GALLERY_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

  if [ -n "$GALLERY_ID" ]; then
    run_test "J1 - 添加评论" \
      "POST" "/api/v1/memoir/gallery/$GALLERY_ID/comments" \
      '{"content":"这张照片拍得真好！"}' \
      '"comment"' \
      "$TOKEN"

    run_test "J2 - 获取评论列表" \
      "GET" "/api/v1/memoir/gallery/$GALLERY_ID/comments" \
      '{}' \
      '"comments"' \
      "$TOKEN"

    run_test "J3 - 生成分享链接" \
      "POST" "/api/v1/memoir/gallery/$GALLERY_ID/share" \
      '{}' \
      '"shareToken"' \
      "$TOKEN"

    # 获取分享 token 测试公开访问
    SHARE_TOKEN=$(echo "$SHARE_RESP" | grep -o '"shareToken":"[^"]*"' | head -1 | sed 's/"shareToken":"//;s/"//')

    if [ -n "$SHARE_TOKEN" ]; then
      SHARED_RESP=$(curl -s "$BASE_URL/shared/photo/$SHARE_TOKEN")
      if echo "$SHARED_RESP" | grep -q '"caption"'; then
        echo -e "  ${GREEN}✅${NC} J4 - 公开访问分享(无需认证)"
        PASSED=$((PASSED + 1))
      else
        echo -e "  ${RED}❌${NC} J4 - 公开访问分享失败"
        echo "      token=$SHARE_TOKEN response=$SHARED_RESP"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "  ${YELLOW}⚠️${NC}  J4 - 跳过 (无法提取shareToken)"
      SKIPPED=$((SKIPPED + 1))
    fi
  fi
fi
echo ""

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
