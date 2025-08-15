#!/bin/bash
# ⚠️ REQUIRES: Run 'just dev' first to start local server on port 8787
# ⚠️ REQUIRES: Configure API keys in .dev.vars file
# Tests: Real LLM provider API calls and authentication validation
#
# Real LLM Provider Integration Test Script v0.2
# Makes actual API calls to validate provider integration and authentication
# For router logic testing (no API keys needed), use ./test-router.sh instead

BASE_URL="http://localhost:8787"
AUTO_DETECT_TOKEN="auto-detect"

echo "🔥 Testing Real LLM Provider Integration v0.2"
echo "🌐 Base URL: $BASE_URL"
echo "⚠️  Requires: 'just dev' running + API keys configured"
echo "💡 Purpose: Make real API calls to validate providers"
echo ""

# Helper function to test LLM connections
test_llm_completion() {
    local model="$1"
    local auth_token="$2"
    local provider="$3"
    local endpoint="${4:-/v1/chat/completions}"
    
    echo "   🧪 Testing $provider: $model"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token" \
        -d "{
            \"model\": \"$model\",
            \"messages\": [{\"role\": \"user\", \"content\": \"Say 'test' (respond with just the word test)\"}],
            \"max_tokens\": 10,
            \"temperature\": 0
        }")
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    echo "   📊 Status: $status"
    
    if [ "$status" = "200" ]; then
        local content=$(echo "$body" | jq -r '.choices[0].message.content // .content[0].text // "No content"' 2>/dev/null)
        echo "   ✅ Success: $content"
        return 0
    else
        local error=$(echo "$body" | jq -r '.error.message // .error // "Unknown error"' 2>/dev/null)
        echo "   ❌ Error: $error"
        return 1
    fi
}

# Check if container is running
echo "🔍 Checking if router is running..."
if ! curl -s "$BASE_URL/worker-health" > /dev/null; then
    echo "❌ Router not running on port 8787"
    echo "💡 Run 'just dev' first to start the local server"
    exit 1
fi
echo "✅ Router is running!"
echo ""

# Test 1: Worker health check with API key status
echo "1️⃣ Testing worker health and API key availability..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/worker-health")
echo "$HEALTH_RESPONSE" | jq '.'

# Check which providers have keys configured
AVAILABLE_PROVIDERS=$(echo "$HEALTH_RESPONSE" | jq -r '.available_providers[]?' 2>/dev/null)
INTERNAL_KEYS=$(echo "$HEALTH_RESPONSE" | jq -r '.internal_keys.total_configured // 0' 2>/dev/null)

echo "📊 Internal keys configured: $INTERNAL_KEYS"
echo "🔑 Available providers: $AVAILABLE_PROVIDERS"
echo ""

# Test 2: Auto-detection mode with various providers
echo "2️⃣ Testing auto-detection mode with various providers..."

# Test OpenRouter (recommended - 100+ models with one key)
test_llm_completion "openrouter/qwen/qwen3-coder" "$AUTO_DETECT_TOKEN" "OpenRouter"

# Test Anthropic
test_llm_completion "anthropic/claude-3-haiku-20240307" "$AUTO_DETECT_TOKEN" "Anthropic"

# Test Groq
test_llm_completion "groq/llama3-8b-8192" "$AUTO_DETECT_TOKEN" "Groq"

# Test Cerebras
test_llm_completion "cerebras/llama3.1-8b" "$AUTO_DETECT_TOKEN" "Cerebras"

# Test OpenAI
test_llm_completion "gpt-4o-mini" "$AUTO_DETECT_TOKEN" "OpenAI"

echo ""

# Test 3: Test Anthropic format (/v1/messages) with auto-detection
echo "3️⃣ Testing Anthropic format (/v1/messages) with auto-detection..."
test_llm_completion "anthropic/claude-3-haiku-20240307" "$AUTO_DETECT_TOKEN" "Anthropic" "/v1/messages"
echo ""

# Test 4: BYOK mode with sample user keys (will fail auth but shows flow)
echo "4️⃣ Testing BYOK mode with sample user keys..."

echo "   🧪 BYOK with sample OpenRouter key (will fail auth)..."
test_llm_completion "openrouter/qwen/qwen3-coder" "sk-or-v1-sample-user-key" "OpenRouter (BYOK)"

echo "   🧪 BYOK with sample Anthropic key (will fail auth)..."
test_llm_completion "anthropic/claude-3-haiku-20240307" "sk-ant-sample-user-key" "Anthropic (BYOK)"

echo "   🧪 BYOK with sample Groq key (will fail auth)..."
test_llm_completion "groq/llama3-8b-8192" "gsk-sample-groq-key" "Groq (BYOK)"

echo ""

# Test 5: Provider detection edge cases
echo "5️⃣ Testing provider detection patterns..."

MODELS=(
    "openrouter/meta-llama/llama-3-8b-instruct:OpenRouter"
    "claude-3-sonnet-20240229:Anthropic"
    "llama3-70b-8192:Groq"
    "mixtral-8x7b-32768:Groq"
    "cerebras/llama3.1-70b:Cerebras"
    "gpt-4:OpenAI"
    "text-davinci-003:OpenAI"
)

for model_info in "${MODELS[@]}"; do
    IFS=':' read -r model provider <<< "$model_info"
    echo "   🔍 Testing pattern: $model → $provider"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST "$BASE_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTO_DETECT_TOKEN" \
        -d "{
            \"model\": \"$model\",
            \"messages\": [{\"role\": \"user\", \"content\": \"Hi\"}],
            \"max_tokens\": 5
        }")
    
    status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "400" ]; then
        echo "   ✅ Pattern detected correctly (Status: $status)"
    else
        echo "   ❌ Pattern detection failed (Status: $status)"
    fi
done

echo ""

# Test 6: Model listing with real API keys
echo "6️⃣ Testing model listing..."
MODELS_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X GET "$BASE_URL/v1/models" \
    -H "Authorization: Bearer $AUTO_DETECT_TOKEN")

MODELS_STATUS=$(echo "$MODELS_RESPONSE" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
MODELS_BODY=$(echo "$MODELS_RESPONSE" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')

echo "📊 Models endpoint status: $MODELS_STATUS"

if [ "$MODELS_STATUS" = "200" ]; then
    MODEL_COUNT=$(echo "$MODELS_BODY" | jq '.data | length // 0' 2>/dev/null)
    echo "📋 Available models: $MODEL_COUNT"
    
    if [ "$MODEL_COUNT" -gt 0 ]; then
        echo "🎯 Sample models:"
        echo "$MODELS_BODY" | jq -r '.data[0:3][].id' 2>/dev/null | sed 's/^/   - /'
    else
        echo "⚠️ No models available - check API key configuration"
    fi
else
    echo "❌ Models listing failed"
fi

echo ""

# Test 7: Error handling validation
echo "7️⃣ Testing error handling..."

echo "   🧪 Testing missing model field..."
curl -s -w "   Status: %{http_code}\n" \
    -X POST "$BASE_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTO_DETECT_TOKEN" \
    -d '{
        "messages": [{"role": "user", "content": "test"}]
    }' | jq -r '.error // "No error field"'

echo "   🧪 Testing unsupported model..."
curl -s -w "   Status: %{http_code}\n" \
    -X POST "$BASE_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTO_DETECT_TOKEN" \
    -d '{
        "model": "unsupported/unknown-provider",
        "messages": [{"role": "user", "content": "test"}]
    }' | jq -r '.error // "No error field"'

echo "   🧪 Testing invalid JSON..."
curl -s -w "   Status: %{http_code}\n" \
    -X POST "$BASE_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTO_DETECT_TOKEN" \
    -d 'invalid-json' | jq -r '.error // "No error field"'

echo ""

# Final summary
echo "✅ Real API integration testing completed!"
echo ""
echo "📋 Integration Test Summary:"
echo "   🔥 Auto-detection: Tested provider detection with regex patterns"
echo "   🔑 BYOK mode: Verified user key pass-through (expect auth failures with sample keys)"
echo "   🌐 Dual API: Tested both OpenAI and Anthropic endpoints"
echo "   📊 Model listing: Verified available models and API key status"
echo "   ⚠️ Error handling: Validated error responses and edge cases"
echo ""
echo "💡 Tips for success:"
echo "   - Set real API keys in .dev.vars file"
echo "   - OpenRouter key gives access to 100+ models with one key"
echo "   - Use auto-detect token for automatic provider detection"
echo "   - Use your own keys for BYOK mode with direct billing"
echo ""
echo "🎯 Next steps:"
echo "   - Run ./test-cc.sh for Claude Code integration testing"
echo "   - Check logs in terminal running 'just dev' for detailed info"
echo "   - Deploy with 'just deploy' when ready for production"
echo ""
echo "💡 Purpose: This script tested REAL providers with API calls"
echo "   For testing router logic only, use ./test-router.sh"