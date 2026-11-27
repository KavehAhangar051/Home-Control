#include <unity.h>

#include <AchaemenidMQTT.h>
#include <AppEvents.h>
#include <Arduino.h>
#include <Optimization/FramedSpscRing.h>
#include <Optimization/ObjectPool.h>
#include <PinManager.h>

#include <cstring>
#include <string>
#include <vector>

void setUp() {
  mockHw().reset();
}

void tearDown() {}

namespace {

struct PoolItem {
  int id;
  int value;
  static int liveCount;

  PoolItem(int i = 0, int v = 0) : id(i), value(v) { ++liveCount; }
  ~PoolItem() { --liveCount; }
};

int PoolItem::liveCount = 0;

} // namespace

// ============================================================================
// 1. StaticObjectPool — Zero-Heap O(1) Reuse & RAII Heap Fallback Tests
// ============================================================================

void test_object_pool_reuses_exact_memory_slot_and_tracks_lifetime() {
  PoolItem::liveCount = 0;
  uniuno::StaticObjectPool<PoolItem, 2> pool;

  TEST_ASSERT_EQUAL_UINT32(2, pool.capacity());
  TEST_ASSERT_EQUAL_UINT32(2, pool.available());
  TEST_ASSERT_EQUAL_UINT32(0, pool.inUse());

  void* firstAddr = nullptr;
  {
    auto p1 = pool.acquire(10, 100);
    auto p2 = pool.acquire(20, 200);
    TEST_ASSERT_TRUE(static_cast<bool>(p1));
    TEST_ASSERT_TRUE(static_cast<bool>(p2));
    TEST_ASSERT_TRUE(p1.isPooled());
    TEST_ASSERT_TRUE(pool.owns(p1.get()));
    TEST_ASSERT_EQUAL_INT(10, p1->id);
    TEST_ASSERT_EQUAL_INT(200, p2->value);
    TEST_ASSERT_EQUAL_UINT32(0, pool.available());
    TEST_ASSERT_EQUAL_UINT32(2, pool.inUse());
    TEST_ASSERT_EQUAL_INT(2, PoolItem::liveCount);

    // Exhausted pool returns empty PooledPtr on acquire()
    auto p3 = pool.acquire(30, 300);
    TEST_ASSERT_FALSE(static_cast<bool>(p3));

    // acquireOrHeap falls back safely without corrupting pool accounting
    auto fallback = pool.acquireOrHeap(40, 400);
    TEST_ASSERT_TRUE(static_cast<bool>(fallback));
    TEST_ASSERT_FALSE(fallback.isPooled());
    TEST_ASSERT_FALSE(pool.owns(fallback.get()));
    TEST_ASSERT_EQUAL_INT(400, fallback->value);
    TEST_ASSERT_EQUAL_INT(3, PoolItem::liveCount);

    firstAddr = p1.get();
    p1.reset();
    TEST_ASSERT_EQUAL_UINT32(1, pool.available());
    TEST_ASSERT_EQUAL_INT(2, PoolItem::liveCount);

    // Next acquire must reuse the exact same slot address (zero heap churn)
    auto reused = pool.acquire(50, 500);
    TEST_ASSERT_TRUE(static_cast<bool>(reused));
    TEST_ASSERT_EQUAL_PTR(firstAddr, reused.get());
    TEST_ASSERT_EQUAL_INT(50, reused->id);
    TEST_ASSERT_EQUAL_INT(500, reused->value);

    // Move semantics transfer ownership without double-destroying
    auto moved = std::move(reused);
    TEST_ASSERT_FALSE(static_cast<bool>(reused));
    TEST_ASSERT_TRUE(static_cast<bool>(moved));
    TEST_ASSERT_EQUAL_PTR(firstAddr, moved.get());
  }

  TEST_ASSERT_EQUAL_UINT32(2, pool.available());
  TEST_ASSERT_EQUAL_UINT32(0, pool.inUse());
  TEST_ASSERT_EQUAL_INT(0, PoolItem::liveCount);
}

void test_global_rule_event_pool_reuses_rule_request_object() {
  auto& pool = uniuno::ruleEventPool();
  TEST_ASSERT_EQUAL_UINT32(pool.capacity(), pool.available());

  void* slotAddr = nullptr;
  {
    auto evt = pool.acquireOrHeap();
    TEST_ASSERT_TRUE(static_cast<bool>(evt));
    TEST_ASSERT_TRUE(evt.isPooled());
    evt->pin = 14;
    evt->rule.active = true;
    slotAddr = evt.get();
  }

  TEST_ASSERT_EQUAL_UINT32(pool.capacity(), pool.available());
  {
    auto evt2 = pool.acquireOrHeap();
    TEST_ASSERT_TRUE(static_cast<bool>(evt2));
    TEST_ASSERT_TRUE(evt2.isPooled());
    TEST_ASSERT_EQUAL_PTR(slotAddr, evt2.get());
    TEST_ASSERT_EQUAL_INT(0, evt2->pin);
    TEST_ASSERT_FALSE(evt2->rule.active);
  }
}

// ============================================================================
// 2. FramedSpscRing — Lock-Free Variable-Length Dual-Core Ring Buffer Tests
// ============================================================================

void test_framed_spsc_ring_fifo_wraparound_and_nul_termination() {
  uniuno::FramedSpscRing<64> ring;
  TEST_ASSERT_FALSE(ring.hasPending());
  TEST_ASSERT_EQUAL_UINT32(0, ring.droppedCount());

  // Push and pop across multiple wrap-around cycles with varying lengths
  for (int i = 0; i < 30; ++i) {
    char msg[32];
    const int n = std::snprintf(msg, sizeof(msg), "{\"seq\":%d,\"pin\":%d}", i, (i % 8) + 1);
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_TRUE(ring.push(reinterpret_cast<const uint8_t*>(msg), static_cast<size_t>(n)));
    TEST_ASSERT_TRUE(ring.hasPending());

    bool popped = ring.pop([&](const uint8_t* payload, size_t len) {
      TEST_ASSERT_EQUAL_UINT32(static_cast<size_t>(n), len);
      TEST_ASSERT_EQUAL_CHAR('\0', static_cast<char>(payload[len]));
      TEST_ASSERT_EQUAL_STRING(msg, reinterpret_cast<const char*>(payload));
    });
    TEST_ASSERT_TRUE(popped);
    TEST_ASSERT_FALSE(ring.hasPending());
  }
  TEST_ASSERT_EQUAL_UINT32(0, ring.droppedCount());
}

void test_framed_spsc_ring_batch_drain_and_overflow_drop_counting() {
  uniuno::FramedSpscRing<64> ring;

  // Fill ring until full (each 12-byte payload takes alignUp(2+12+1)=16 bytes -> 3 fit in 64B reserving 4B gap)
  const char* p1 = "frame_alpha1";
  const char* p2 = "frame_bravo2";
  const char* p3 = "frame_charl3";
  const char* p4 = "frame_delta4";

  TEST_ASSERT_TRUE(ring.push(reinterpret_cast<const uint8_t*>(p1), std::strlen(p1)));
  TEST_ASSERT_TRUE(ring.push(reinterpret_cast<const uint8_t*>(p2), std::strlen(p2)));
  TEST_ASSERT_TRUE(ring.push(reinterpret_cast<const uint8_t*>(p3), std::strlen(p3)));
  TEST_ASSERT_FALSE(ring.push(reinterpret_cast<const uint8_t*>(p4), std::strlen(p4)));
  TEST_ASSERT_EQUAL_UINT32(1, ring.droppedCount());

  // Reject empty or oversized payloads cleanly
  TEST_ASSERT_FALSE(ring.push(nullptr, 5));
  TEST_ASSERT_FALSE(ring.push(reinterpret_cast<const uint8_t*>(p1), 0));
  uint8_t oversized[64]{};
  TEST_ASSERT_FALSE(ring.push(oversized, sizeof(oversized)));
  TEST_ASSERT_EQUAL_UINT32(2, ring.droppedCount());

  std::vector<std::string> received;
  const size_t drained = ring.drain(
      [&](const uint8_t* payload, size_t len) { received.emplace_back(reinterpret_cast<const char*>(payload), len); },
      16);

  TEST_ASSERT_EQUAL_UINT32(3, drained);
  TEST_ASSERT_FALSE(ring.hasPending());
  TEST_ASSERT_EQUAL_STRING(p1, received[0].c_str());
  TEST_ASSERT_EQUAL_STRING(p2, received[1].c_str());
  TEST_ASSERT_EQUAL_STRING(p3, received[2].c_str());
}

// ============================================================================
// 3. AchaemenidMQTT — Cached State Topic & Dual-Core RX Queue Handoff Tests
// ============================================================================

void test_mqtt_cached_state_topic_and_dual_core_queue_handoff() {
  uniuno::AchaemenidMQTT mqtt;
  mqtt.begin("broker.local", 1883, "Home/LivingRoom", 1, "user", "pass");
  TEST_ASSERT_EQUAL_STRING("Home/LivingRoom", mqtt.getBaseTopicCStr());
  TEST_ASSERT_EQUAL_STRING("Home/LivingRoom/State", mqtt.getStateTopicCStr());

  mqtt.testMqttClient().mockConnected = true;
  const char* ack = "{\"type\":\"command_ack\",\"pin\":2,\"state\":true}";
  TEST_ASSERT_TRUE(mqtt.publishState(ack, std::strlen(ack), false));
  TEST_ASSERT_EQUAL_STRING("Home/LivingRoom/State", mqtt.testMqttClient().mockLastPublishedTopic.c_str());
  TEST_ASSERT_EQUAL_STRING(ack, mqtt.testMqttClient().mockLastPublishedPayload.c_str());

  std::vector<std::string> delivered;
  mqtt.setCallback(
      [&](const uint8_t* payload, size_t len) { delivered.emplace_back(reinterpret_cast<const char*>(payload), len); });

  const char* cmd1 = "{\"command\":\"set_state\",\"pin\":2,\"state\":1}";
  const char* cmd2 = "{\"command\":\"set_state\",\"pin\":4,\"state\":0}";
  TEST_ASSERT_FALSE(mqtt.hasPendingCommands());
  TEST_ASSERT_TRUE(mqtt.enqueueCommand(reinterpret_cast<const uint8_t*>(cmd1), std::strlen(cmd1)));
  TEST_ASSERT_TRUE(mqtt.enqueueCommand(reinterpret_cast<const uint8_t*>(cmd2), std::strlen(cmd2)));
  TEST_ASSERT_TRUE(mqtt.hasPendingCommands());

  mqtt.processQueue();
  TEST_ASSERT_FALSE(mqtt.hasPendingCommands());
  TEST_ASSERT_EQUAL_UINT32(2, delivered.size());
  TEST_ASSERT_EQUAL_STRING(cmd1, delivered[0].c_str());
  TEST_ASSERT_EQUAL_STRING(cmd2, delivered[1].c_str());
}

// ============================================================================
// 4. Zero-Copy Large Struct Reference Access in PinManager
// ============================================================================

void test_pin_manager_get_rule_by_pin_returns_zero_copy_reference() {
  PinManager pm;
  RuleConfig rule{};
  rule.active = true;
  rule.highActionCount = 1;
  rule.highActions[0].targetPin = 2;
  rule.highActions[0].actionState = true;

  TEST_ASSERT_TRUE(pm.addSegment("btn_1", SegmentType::Input, 14, 0, rule));

  const RuleConfig* ptr = pm.getRuleByPinPtr(14);
  const RuleConfig& ref = pm.getRuleByPin(14);

  TEST_ASSERT_NOT_NULL(ptr);
  // Reference address must match internal storage address (proves zero ~724B copy)
  TEST_ASSERT_EQUAL_PTR(ptr, &ref);
  TEST_ASSERT_TRUE(ref.active);
  TEST_ASSERT_EQUAL_INT(2, ref.highActions[0].targetPin);

  // Unregistered pin returns stable empty sentinel reference without crashing
  const RuleConfig& missing = pm.getRuleByPin(99);
  TEST_ASSERT_FALSE(missing.active);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_object_pool_reuses_exact_memory_slot_and_tracks_lifetime);
  RUN_TEST(test_global_rule_event_pool_reuses_rule_request_object);
  RUN_TEST(test_framed_spsc_ring_fifo_wraparound_and_nul_termination);
  RUN_TEST(test_framed_spsc_ring_batch_drain_and_overflow_drop_counting);
  RUN_TEST(test_mqtt_cached_state_topic_and_dual_core_queue_handoff);
  RUN_TEST(test_pin_manager_get_rule_by_pin_returns_zero_copy_reference);
  return UNITY_END();
}
