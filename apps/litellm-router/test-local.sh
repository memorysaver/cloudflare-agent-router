#!/bin/bash
# Local LiteLLM Router Test Script
# Tests the simplified router logic locally

BASE_URL="http://localhost:8787"
PREMIUM_KEY="sk-car-premium-router-key-for-internal-api-access"

echo "🧪 Testing Simplified LiteLLM Router (Local Mode)"
echo "🌐 Base URL: $BASE_URL"
echo ""

# Test 1: Health check (new simplified format)
echo "1️⃣ Testing health check..."
curl -s "$BASE_URL/worker-health" | jq '.'
echo ""

# Test 2: Health check without auth (should still work for health)
echo "2️⃣ Testing LiteLLM health endpoint without auth (should fail)..."
curl -s -w '\n🔍 Status: %{http_code}\n' \
  -X GET "$BASE_URL/health"
echo ""

# Test 3: Health check with premium key
echo "3️⃣ Testing LiteLLM health endpoint with auth..."
curl -s -w '\n🔍 Status: %{http_code}\n' \
  -X GET "$BASE_URL/health" \
  -H "Authorization: Bearer $PREMIUM_KEY" | head -10
echo ""

# Test 4: List models with premium key
echo "4️⃣ Testing models endpoint..."
MODEL_COUNT=$(curl -s -X GET "$BASE_URL/v1/models" \
  -H "Authorization: Bearer $PREMIUM_KEY" | jq '.data | length // 0')
echo "📊 Available models: $MODEL_COUNT"
echo ""

# Test 5: Test auto-detection with no auth key (should fail with clear error)
echo "5️⃣ Testing auto-detection without auth key..."
curl -s -w '\n🔍 Status: %{http_code}\n' \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }' | jq '.'
echo ""

# Test 6: Test user-provided key mode (BYOK)
echo "6️⃣ Testing BYOK mode with user key..."
curl -s -w '\n🔍 Status: %{http_code}\n' \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer gsk-fake-groq-key-123' \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }' | jq '.error.message // .choices[0].message.content // .'
echo ""

# Test 7: Test auto-detection with no user key (should use internal key)
echo "7️⃣ Testing auto-detection mode (should detect groq and use internal key)..."
curl -s -w '\n🔍 Status: %{http_code}\n' \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer auto-detect' \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "Say hello in 1 word"}],
    "max_tokens": 10
  }' | jq '.choices[0].message.content // .error.message // .'
echo ""

echo "✅ Local test suite completed!"
echo ""
echo "📋 Summary of Simplified Router:"
echo "   - Removed premium/BYOK complexity"
echo "   - Single flow: bring your key OR auto-detect"
echo "   - Modular architecture with utils and handlers"
echo "   - Better error messages"
echo "   - Cleaner health check"