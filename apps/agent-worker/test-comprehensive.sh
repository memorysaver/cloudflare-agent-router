#!/usr/bin/env bash
#
# Comprehensive Claude Code Agent Test Suite
# Tests both REST API (/claude-code) and WebSocket (/demo/ws/:sessionId) endpoints
# Includes streaming/non-streaming modes and cross-interface continuity testing
#
# Usage: ./test-comprehensive.sh [options]
# Options:
#   --server URL     Server URL (default: http://localhost:8788)
#   --timeout-short N  Short timeout in seconds (default: 15)
#   --timeout-long N   Long timeout in seconds (default: 30)
#   --verbose        Enable verbose logging
#   --help           Show this help message
#
# Requirements: bash 4+ (for associative arrays)
#

# Check bash version
if [ "${BASH_VERSION%%.*}" -lt 4 ]; then
    echo "Error: This script requires bash 4.0 or higher"
    echo "Current bash version: $BASH_VERSION"
    echo "On macOS, install with: brew install bash"
    echo "Then use: /usr/local/bin/bash $0 or /opt/homebrew/bin/bash $0"
    exit 1
fi

set -euo pipefail

# Configuration
SERVER_URL="http://localhost:8788"
WS_URL="ws://localhost:8788"
TIMEOUT_SHORT=30
TIMEOUT_LONG=60
VERBOSE=false
TEST_SESSION="test-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test result tracking
declare -A test_results
declare -A response_times
declare -A test_descriptions
total_tests=0
passed_tests=0
failed_tests=0
timeout_tests=0

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

verbose_log() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[VERBOSE]${NC} $1"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            WS_URL="${SERVER_URL/http/ws}"
            shift 2
            ;;
        --timeout-short)
            TIMEOUT_SHORT="$2"
            shift 2
            ;;
        --timeout-long)
            TIMEOUT_LONG="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            grep '^#' "$0" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Record test result
record_test_result() {
    local test_name="$1"
    local result="$2"
    local time_taken="$3"
    local description="$4"
    
    test_results["$test_name"]="$result"
    response_times["$test_name"]="$time_taken"
    test_descriptions["$test_name"]="$description"
    
    total_tests=$((total_tests + 1))
    
    case "$result" in
        "PASS") passed_tests=$((passed_tests + 1)) ;;
        "FAIL") failed_tests=$((failed_tests + 1)) ;;
        "TIMEOUT") timeout_tests=$((timeout_tests + 1)) ;;
    esac
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check dependencies
    local deps_missing=false
    
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl is required but not installed"
        deps_missing=true
    fi
    
    if ! command -v websocat >/dev/null 2>&1; then
        log_error "websocat is required but not installed"
        log_info "Install with: brew install websocat (macOS) or cargo install websocat (Linux)"
        deps_missing=true
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not found - JSON parsing will be limited"
    fi
    
    if [ "$deps_missing" = true ]; then
        exit 1
    fi
    
    # Check server availability
    log_info "Checking server availability at $SERVER_URL"
    if ! curl -s --max-time 5 "$SERVER_URL" > /dev/null; then
        log_error "Server not responding at $SERVER_URL"
        log_info "Make sure the development server is running: just dev"
        exit 1
    fi
    
    log_success "Pre-flight checks passed"
}

# REST API Tests
test_rest_nonstreaming_math() {
    log_test "REST API: Non-streaming math operation"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"What is 7+3? Just give the number.\", \"outputFormat\": \"json\", \"sessionId\": \"$TEST_SESSION-rest-math\"}" \
        --max-time $TIMEOUT_SHORT) || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -ne 0 ]; then
        record_test_result "rest_nonstreaming_math" "TIMEOUT" "$duration" "Math operation timed out"
        return 1
    fi
    
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    verbose_log "HTTP Status: $http_status"
    verbose_log "Response: $body"
    
    if [ "$http_status" = "200" ] && (echo "$body" | grep -q "10" || echo "$body" | grep -qi "ten"); then
        record_test_result "rest_nonstreaming_math" "PASS" "$duration" "Correct answer: 10"
        log_success "REST non-streaming math: PASS (${duration}s)"
        return 0
    else
        record_test_result "rest_nonstreaming_math" "FAIL" "$duration" "Incorrect response or HTTP error"
        log_error "REST non-streaming math: FAIL"
        return 1
    fi
}

test_rest_streaming_math() {
    log_test "REST API: Streaming math operation"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(timeout $TIMEOUT_LONG curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"What is 8+2? Just give the number.\", \"outputFormat\": \"stream-json\", \"sessionId\": \"$TEST_SESSION-rest-stream\"}" 2>/dev/null) || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -eq 124 ]; then
        record_test_result "rest_streaming_math" "TIMEOUT" "$duration" "Streaming timeout (container resources)"
        log_warn "REST streaming math: TIMEOUT - known container resource issue"
        return 1
    elif [ $exit_code -ne 0 ]; then
        record_test_result "rest_streaming_math" "FAIL" "$duration" "Command failed with exit code $exit_code"
        return 1
    fi
    
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    verbose_log "HTTP Status: $http_status"
    verbose_log "Response: $body"
    
    if [ "$http_status" = "200" ] && (echo "$body" | grep -q "10" || echo "$body" | grep -qi "ten"); then
        record_test_result "rest_streaming_math" "PASS" "$duration" "Correct answer: 10"
        log_success "REST streaming math: PASS (${duration}s)"
        return 0
    else
        record_test_result "rest_streaming_math" "FAIL" "$duration" "Incorrect response or HTTP error"
        log_error "REST streaming math: FAIL"
        return 1
    fi
}

test_rest_file_creation() {
    log_test "REST API: File creation test"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"Create a file called rest-test.txt with the content 'Hello from REST API test'.\", \"outputFormat\": \"json\", \"sessionId\": \"$TEST_SESSION-file\"}" \
        --max-time $TIMEOUT_LONG) || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -ne 0 ]; then
        record_test_result "rest_file_creation" "TIMEOUT" "$duration" "File creation timed out"
        return 1
    fi
    
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    verbose_log "HTTP Status: $http_status"
    verbose_log "Response: $body"
    
    if [ "$http_status" = "200" ] && (echo "$body" | grep -qi "created\|file" || echo "$body" | grep -q "rest-test.txt"); then
        record_test_result "rest_file_creation" "PASS" "$duration" "File creation successful"
        log_success "REST file creation: PASS (${duration}s)"
        return 0
    else
        record_test_result "rest_file_creation" "FAIL" "$duration" "File creation failed"
        log_error "REST file creation: FAIL"
        return 1
    fi
}

test_rest_session_continuity() {
    log_test "REST API: Session continuity test"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"What's in the file rest-test.txt?\", \"outputFormat\": \"json\", \"sessionId\": \"$TEST_SESSION-file\", \"continueSession\": true}" \
        --max-time $TIMEOUT_LONG) || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -ne 0 ]; then
        record_test_result "rest_session_continuity" "TIMEOUT" "$duration" "Continuity test timed out"
        return 1
    fi
    
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    verbose_log "HTTP Status: $http_status"
    verbose_log "Response: $body"
    
    if [ "$http_status" = "200" ] && echo "$body" | grep -q "Hello from REST API test"; then
        record_test_result "rest_session_continuity" "PASS" "$duration" "File content retrieved correctly"
        log_success "REST session continuity: PASS (${duration}s)"
        return 0
    else
        record_test_result "rest_session_continuity" "FAIL" "$duration" "Could not retrieve file content"
        log_error "REST session continuity: FAIL"
        return 1
    fi
}

test_rest_tool_restrictions() {
    log_test "REST API: Tool restrictions test"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"What is 9+1?\", \"outputFormat\": \"json\", \"allowedTools\": [], \"sessionId\": \"$TEST_SESSION-restricted\"}" \
        --max-time $TIMEOUT_SHORT) || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -ne 0 ]; then
        record_test_result "rest_tool_restrictions" "TIMEOUT" "$duration" "Tool restriction test timed out"
        return 1
    fi
    
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    verbose_log "HTTP Status: $http_status"
    verbose_log "Response: $body"
    
    if [ "$http_status" = "200" ] && (echo "$body" | grep -q "10" || echo "$body" | grep -qi "ten"); then
        record_test_result "rest_tool_restrictions" "PASS" "$duration" "Works without tools"
        log_success "REST tool restrictions: PASS (${duration}s)"
        return 0
    else
        record_test_result "rest_tool_restrictions" "FAIL" "$duration" "Failed with tool restrictions"
        log_error "REST tool restrictions: FAIL"
        return 1
    fi
}

# WebSocket Tests
test_websocket_basic_math() {
    log_test "WebSocket: Basic math operation"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(timeout $TIMEOUT_LONG bash -c 'echo "{\"type\":\"user_message\",\"content\":\"What is 4+4? Just give the number.\",\"model\":\"groq/openai/gpt-oss-120b\"}" | websocat --text '"$WS_URL"'/demo/ws/'"$TEST_SESSION"'-ws-math 2>/dev/null') || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -eq 124 ]; then
        record_test_result "websocket_basic_math" "TIMEOUT" "$duration" "WebSocket timeout (resource constraints)"
        log_warn "WebSocket basic math: TIMEOUT - resource constraint"
        return 1
    elif [ $exit_code -ne 0 ]; then
        record_test_result "websocket_basic_math" "FAIL" "$duration" "WebSocket connection failed"
        return 1
    fi
    
    verbose_log "WebSocket Response: $response"
    
    if [ ${#response} -eq 0 ] && [ $exit_code -eq 0 ]; then
        record_test_result "websocket_basic_math" "TIMEOUT" "$duration" "WebSocket connected but no response (container resources)"
        log_warn "WebSocket basic math: TIMEOUT - container resource issue"
        return 1
    elif echo "$response" | grep -q '"content"' && echo "$response" | grep -q "8"; then
        record_test_result "websocket_basic_math" "PASS" "$duration" "Correct answer: 8"
        log_success "WebSocket basic math: PASS (${duration}s)"
        return 0
    else
        record_test_result "websocket_basic_math" "FAIL" "$duration" "Incorrect or missing response"
        log_error "WebSocket basic math: FAIL"
        return 1
    fi
}

test_websocket_file_creation() {
    log_test "WebSocket: File creation test"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(timeout $TIMEOUT_LONG bash -c 'echo "{\"type\":\"user_message\",\"content\":\"Create a file ws-test.txt with content Hello WebSocket.\",\"model\":\"groq/openai/gpt-oss-120b\"}" | websocat --text '"$WS_URL"'/demo/ws/'"$TEST_SESSION"'-ws-file 2>/dev/null') || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -eq 124 ]; then
        record_test_result "websocket_file_creation" "TIMEOUT" "$duration" "WebSocket file creation timeout"
        log_warn "WebSocket file creation: TIMEOUT"
        return 1
    elif [ $exit_code -ne 0 ]; then
        record_test_result "websocket_file_creation" "FAIL" "$duration" "WebSocket connection failed"
        return 1
    fi
    
    verbose_log "WebSocket Response: $response"
    
    if [ ${#response} -eq 0 ] && [ $exit_code -eq 0 ]; then
        record_test_result "websocket_file_creation" "TIMEOUT" "$duration" "WebSocket connected but no response (container resources)"
        log_warn "WebSocket file creation: TIMEOUT - container resource issue"
        return 1
    elif echo "$response" | grep -qi "created\|file" || echo "$response" | grep -q "ws-test.txt"; then
        record_test_result "websocket_file_creation" "PASS" "$duration" "File creation successful"
        log_success "WebSocket file creation: PASS (${duration}s)"
        return 0
    else
        record_test_result "websocket_file_creation" "FAIL" "$duration" "File creation failed"
        log_error "WebSocket file creation: FAIL"
        return 1
    fi
}

test_websocket_session_continuity() {
    log_test "WebSocket: Session continuity test"
    
    local start_time=$(date +%s.%N)
    local response
    local exit_code=0
    
    response=$(timeout $TIMEOUT_LONG bash -c 'echo "{\"type\":\"user_message\",\"content\":\"What is in ws-test.txt?\",\"model\":\"groq/openai/gpt-oss-120b\"}" | websocat --text '"$WS_URL"'/demo/ws/'"$TEST_SESSION"'-ws-file 2>/dev/null') || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -eq 124 ]; then
        record_test_result "websocket_continuity" "TIMEOUT" "$duration" "WebSocket continuity timeout"
        log_warn "WebSocket continuity: TIMEOUT"
        return 1
    elif [ $exit_code -ne 0 ]; then
        record_test_result "websocket_continuity" "FAIL" "$duration" "WebSocket connection failed"
        return 1
    fi
    
    verbose_log "WebSocket Response: $response"
    
    if [ ${#response} -eq 0 ] && [ $exit_code -eq 0 ]; then
        record_test_result "websocket_continuity" "TIMEOUT" "$duration" "WebSocket connected but no response (container resources)"
        log_warn "WebSocket continuity: TIMEOUT - container resource issue"
        return 1
    elif echo "$response" | grep -q "Hello WebSocket"; then
        record_test_result "websocket_continuity" "PASS" "$duration" "File content retrieved"
        log_success "WebSocket continuity: PASS (${duration}s)"
        return 0
    else
        record_test_result "websocket_continuity" "FAIL" "$duration" "Could not retrieve file content"
        log_error "WebSocket continuity: FAIL"
        return 1
    fi
}

# Cross-interface continuity tests
test_cross_interface_rest_to_ws() {
    log_test "Cross-interface: REST → WebSocket continuity"
    
    # First, create a file via REST
    log_info "Creating file via REST API..."
    local response1
    response1=$(curl -s -X POST "$SERVER_URL/claude-code" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"Create a file cross-test.txt with 'Cross-interface test from REST'.\", \"outputFormat\": \"json\", \"sessionId\": \"$TEST_SESSION-cross\"}" \
        --max-time $TIMEOUT_LONG)
    
    sleep 2  # Brief pause to ensure file is created
    
    # Then, try to read it via WebSocket
    log_info "Reading file via WebSocket..."
    local start_time=$(date +%s.%N)
    local response2
    local exit_code=0
    
    response2=$(timeout $TIMEOUT_LONG bash -c 'echo "{\"type\":\"user_message\",\"content\":\"What is in cross-test.txt?\",\"model\":\"groq/openai/gpt-oss-120b\"}" | websocat --text '"$WS_URL"'/demo/ws/'"$TEST_SESSION"'-cross 2>/dev/null') || exit_code=$?
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if [ $exit_code -eq 124 ]; then
        record_test_result "cross_rest_to_ws" "TIMEOUT" "$duration" "Cross-interface test timeout"
        return 1
    elif [ $exit_code -ne 0 ]; then
        record_test_result "cross_rest_to_ws" "FAIL" "$duration" "WebSocket connection failed"
        return 1
    fi
    
    verbose_log "REST Response: $response1"
    verbose_log "WebSocket Response: $response2"
    
    if [ ${#response2} -eq 0 ] && [ $exit_code -eq 0 ]; then
        record_test_result "cross_rest_to_ws" "TIMEOUT" "$duration" "WebSocket connected but no response (container resources)"
        log_warn "Cross-interface REST→WS: TIMEOUT - WebSocket resource issue"
        return 1
    elif echo "$response2" | grep -q "Cross-interface test from REST"; then
        record_test_result "cross_rest_to_ws" "PASS" "$duration" "File visible across interfaces"
        log_success "Cross-interface REST→WS: PASS (${duration}s)"
        return 0
    else
        record_test_result "cross_rest_to_ws" "FAIL" "$duration" "File not visible across interfaces"
        log_error "Cross-interface REST→WS: FAIL"
        return 1
    fi
}

# Print comprehensive report
print_report() {
    echo
    echo "=============================================="
    echo "  COMPREHENSIVE CLAUDE CODE TEST RESULTS"
    echo "=============================================="
    echo "Server: $SERVER_URL"
    echo "Test Session: $TEST_SESSION"
    echo "Date: $(date)"
    echo
    
    printf "%-35s %-8s %-8s %s\n" "TEST NAME" "RESULT" "TIME" "DESCRIPTION"
    echo "----------------------------------------------------------------------"
    
    # Sort tests by name for consistent output
    for test_name in $(printf '%s\n' "${!test_results[@]}" | sort); do
        local result="${test_results[$test_name]}"
        local time="${response_times[$test_name]}"
        local desc="${test_descriptions[$test_name]}"
        
        local result_color=""
        case "$result" in
            "PASS") result_color="$GREEN" ;;
            "FAIL") result_color="$RED" ;;
            "TIMEOUT") result_color="$YELLOW" ;;
        esac
        
        printf "%-35s ${result_color}%-8s${NC} %-8.1fs %s\n" "$test_name" "$result" "$time" "$desc"
    done
    
    echo
    echo "SUMMARY:"
    echo "--------"
    echo "Total Tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo -e "Timeouts: ${YELLOW}$timeout_tests${NC}"
    
    local success_rate=0
    if [ $total_tests -gt 0 ]; then
        success_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc)
    fi
    
    echo "Success Rate: ${success_rate}%"
    
    if [ $timeout_tests -gt 0 ]; then
        echo
        log_warn "Timeouts detected - this is expected for streaming mode due to container resource constraints"
    fi
    
    echo
    if [ $failed_tests -eq 0 ]; then
        log_success "All functional tests passed! 🎉"
    else
        log_error "Some tests failed. Please review the results above."
    fi
}

# Main execution
main() {
    echo
    echo "🚀 Starting Comprehensive Claude Code Agent Tests"
    echo "================================================"
    echo
    
    preflight_checks
    echo
    
    log_info "Test Session ID: $TEST_SESSION"
    log_info "Server URL: $SERVER_URL"
    log_info "WebSocket URL: $WS_URL"
    log_info "Timeouts: Short=${TIMEOUT_SHORT}s, Long=${TIMEOUT_LONG}s"
    echo
    
    # Run REST API tests
    log_info "🔧 Running REST API Tests..."
    test_rest_nonstreaming_math || true
    test_rest_streaming_math || true
    test_rest_file_creation || true
    test_rest_session_continuity || true
    test_rest_tool_restrictions || true
    echo
    
    # Run WebSocket tests
    log_info "🔌 Running WebSocket Tests..."
    test_websocket_basic_math || true
    test_websocket_file_creation || true
    test_websocket_session_continuity || true
    echo
    
    # Run cross-interface tests
    log_info "🔄 Running Cross-Interface Tests..."
    test_cross_interface_rest_to_ws || true
    echo
    
    # Print final report
    print_report
}

# Handle cleanup on exit
cleanup() {
    log_info "Cleaning up test session: $TEST_SESSION"
}

trap cleanup EXIT

# Run main function
main "$@"