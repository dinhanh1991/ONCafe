from conftest import BASE_URL


def open_app(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")


# ---------- Model và bộ so sánh (hàm thuần) ----------

def test_notification_model_builds_text_and_rejects_invalid_input(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createOrderNotification, createNotificationKey } =
                await import("/js/models/OrderNotification.js");
            const online = createOrderNotification("new", {
                id: 7, order_code: "ON-7", order_source: "online", fulfillment_method: "delivery",
                customer_name: "An", total_amount: 85000, status: "pending"
            }, { actor: "u1" });
            const counter = createOrderNotification("new", { id: 8, order_source: "counter", total_amount: 0 });
            const done = createOrderNotification("completed", { id: 9, order_code: "ON-9", customer_name: "Bình", total_amount: 40000 });
            return {
                online, counterTitle: counter.title, counterDetail: counter.detail, doneTitle: done.title,
                badType: createOrderNotification("deleted", { id: 1 }),
                noId: createOrderNotification("new", {}),
                key: createNotificationKey("new", 7)
            };
        }"""
    )

    assert result["online"]["key"] == "new:7"
    assert result["online"]["actor"] == "u1"
    assert result["online"]["title"] == "Đơn mới ON-7"
    assert "Đơn online" in result["online"]["detail"]
    assert "Giao tận nhà" in result["online"]["detail"]
    assert result["counterTitle"] == "Đơn mới #8"
    assert "Đơn tại quầy" in result["counterDetail"]
    assert result["doneTitle"] == "Đơn ON-9 đã hoàn tất"
    assert result["badType"] is None
    assert result["noId"] is None
    assert result["key"] == "new:7"


def test_change_detector_finds_new_and_completed_orders(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { buildSnapshot, detectOrderChanges } =
                await import("/js/services/OrderChangeDetector.js");
            const previous = buildSnapshot([
                { id: 1, status: "preparing" }, { id: 2, status: "completed" }, { id: 3, status: "pending" }
            ]);
            const changes = detectOrderChanges(previous, [
                { id: 4, status: "pending" },
                { id: 1, status: "completed" },
                { id: 2, status: "completed" },
                { id: 3, status: "cancelled" }
            ]);
            return { previous, changes: changes.map((c) => c.key) };
        }"""
    )

    assert result["previous"] == {"1": "preparing", "2": "completed", "3": "pending"}
    assert result["changes"] == ["new:4", "completed:1"]


# ---------- Repository ----------

def test_state_repository_persists_per_user_and_caps_seen_keys(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { NotificationStateRepository } =
                await import("/js/repositories/NotificationStateRepo.js");
            localStorage.clear();
            const a = new NotificationStateRepository({ userId: "a" });
            const b = new NotificationStateRepository({ userId: "b" });
            a.saveSnapshot({ "1": "pending" });
            a.addSeen("new:1");
            for (let i = 0; i < 350; i++) a.addSeen("new:x" + i);
            a.setSoundEnabled(false);
            const again = new NotificationStateRepository({ userId: "a" });
            return {
                snapshotA: again.getSnapshot(), snapshotB: b.getSnapshot(),
                oldestDropped: !again.hasSeen("new:1"), newestKept: again.hasSeen("new:x349"),
                seenCount: JSON.parse(localStorage.getItem("oncafe:notifications:a:seen")).length,
                soundA: again.isSoundEnabled(), soundB: b.isSoundEnabled()
            };
        }"""
    )

    assert result["snapshotA"] == {"1": "pending"}
    assert result["snapshotB"] is None
    assert result["oldestDropped"] is True
    assert result["newestKept"] is True
    assert result["seenCount"] == 300
    assert result["soundA"] is False
    assert result["soundB"] is True


def test_state_repository_works_when_storage_is_blocked(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { NotificationStateRepository } =
                await import("/js/repositories/NotificationStateRepo.js");
            const blocked = {
                getItem: () => { throw new Error("blocked"); },
                setItem: () => { throw new Error("blocked"); }
            };
            const repo = new NotificationStateRepository({ userId: "a", storage: blocked });
            repo.saveSnapshot({ "5": "pending" });
            repo.addSeen("new:5");
            return { snapshot: repo.getSnapshot(), seen: repo.hasSeen("new:5"), history: repo.getHistory() };
        }"""
    )

    assert result == {"snapshot": {"5": "pending"}, "seen": True, "history": []}


def test_realtime_repository_opens_private_channel_with_auth(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { OrderRealtimeRepository } =
                await import("/js/repositories/OrderRealtimeRepo.js");
            const calls = [];
            const handlers = {};
            let statusCallback = null;
            const client = {
                auth: { getSession: async () => ({ data: { session: { access_token: "tok-123" } } }) },
                realtime: { setAuth: (token) => calls.push(["setAuth", token]) },
                channel: (topic, options) => {
                    calls.push(["channel", topic, options]);
                    const channel = {
                        on: (type, filter, callback) => { handlers[filter.event] = callback; calls.push(["on", type, filter.event]); return channel; },
                        subscribe: (callback) => { statusCallback = callback; calls.push(["subscribe"]); return channel; }
                    };
                    return channel;
                },
                removeChannel: async () => calls.push(["remove"])
            };
            const received = [];
            const statuses = [];
            const repo = new OrderRealtimeRepository({ client });
            await repo.subscribe({ onEvent: (p) => received.push(p), onStatusChange: (s) => statuses.push(s) });
            handlers.order_new({ payload: { type: "new", order: { id: 1 } } });
            handlers.order_completed({ payload: { type: "completed", order: { id: 2 } } });
            statusCallbacks.forEach(({ callback }) => callback("SUBSCRIBED"));
            await repo.unsubscribe();
            return { calls, received, statuses };
        }"""
    )

    assert result["calls"] == [
        ["setAuth", "tok-123"],
        ["channel", "oncafe:staff-orders", {"config": {"private": True}}],
        ["on", "broadcast", "order_new"],
        ["on", "broadcast", "order_completed"],
        ["subscribe"],
        ["remove"],
    ]
    assert [item["type"] for item in result["received"]] == ["new", "completed"]
    assert result["statuses"] == ["SUBSCRIBED"]


# ---------- Service ----------

SERVICE_SETUP = """
    const { OrderNotificationService } = await import("/js/services/OrderNotificationService.js");
    const { NotificationStateRepository } = await import("/js/repositories/NotificationStateRepo.js");
    localStorage.clear();
    const make = (overrides = {}) => {
        const delivered = [];
        const connection = [];
        const state = new NotificationStateRepository({ userId: "me" });
        const service = new OrderNotificationService({
            realtimeRepository: { subscribe: async () => {}, unsubscribe: async () => {} },
            getOrders: async () => [],
            stateRepository: state,
            currentUserId: "me",
            onNotify: (items) => delivered.push(items.map((n) => n.key)),
            onConnectionChange: (c) => connection.push(c),
            onError: () => {},
            ...overrides
        });
        return { service, state, delivered, connection };
    };
"""


def test_service_first_sync_is_silent_then_reports_changes_once(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            let orders = [{ id: 1, status: "preparing" }];
            const { service, delivered } = make({ getOrders: async () => orders });
            await service.sync();
            orders = [{ id: 2, status: "pending" }, { id: 1, status: "completed" }];
            await service.sync();
            await service.sync();
            return delivered;
        }"""
    )

    assert result == [["new:2", "completed:1"]]


def test_service_realtime_event_is_delivered_once_even_if_sync_sees_it(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            let orders = [{ id: 1, status: "pending" }];
            const { service, delivered } = make({ getOrders: async () => orders });
            await service.sync(); // baseline

            const payload = { type: "new", actor: "customer-9",
                order: { id: 2, order_code: "ON-2", status: "pending", order_source: "online", total_amount: 1000 } };
            service.handleRealtimeEvent(payload);
            service.handleRealtimeEvent(payload); // gửi lặp: không báo lại
            orders = [{ id: 2, status: "pending" }, { id: 1, status: "pending" }];
            await service.sync(); // đồng bộ cũng thấy đơn 2: không báo lại
            return delivered;
        }"""
    )

    assert result == [["new:2"]]


def test_service_ignores_actions_made_by_current_user(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            let orders = [{ id: 1, status: "ready_for_pickup" }];
            const { service, delivered } = make({ getOrders: async () => orders });
            await service.sync();

            // Sự kiện realtime do chính mình thực hiện.
            service.handleRealtimeEvent({ type: "completed", actor: "me", order: { id: 1, status: "completed" } });
            // Đơn quầy do chính mình lập, chỉ thấy qua đồng bộ dự phòng.
            service.markHandled("new", 2);
            orders = [{ id: 2, status: "pending" }, { id: 1, status: "completed" }];
            await service.sync();
            // Đơn của người khác vẫn được báo.
            orders = [{ id: 3, status: "pending" }, ...orders];
            await service.sync();
            return delivered;
        }"""
    )

    assert result == [["new:3"]]


def test_service_connection_status_and_catch_up_sync(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            let calls = 0;
            let orders = [{ id: 1, status: "pending" }];
            const { service, delivered, connection } = make({
                getOrders: async () => { calls += 1; return orders; }
            });
            await service.sync(); // baseline, calls = 1

            orders = [{ id: 2, status: "pending" }, ...orders]; // phát sinh khi chưa kết nối
            service.handleStatus("SUBSCRIBED");
            await new Promise((resolve) => setTimeout(resolve, 20));
            service.handleStatus("TIMED_OUT");
            service.handleStatus("SUBSCRIBED");
            service.handleStatus("CLOSED");
            return { delivered, connection, calls };
        }"""
    )

    assert result["delivered"] == [["new:2"]]
    assert result["connection"] == [True, False, True, False]


def test_service_reports_errors_and_stops_cleanly(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            const errors = [];
            let fail = true;
            let captured = null;
            const { service, delivered, state } = make({
                getOrders: async () => { if (fail) throw new Error("mất kết nối"); return [{ id: 1, status: "pending" }]; },
                onError: (error) => errors.push(error.message),
                realtimeRepository: {
                    subscribe: async (handlers) => { captured = handlers; },
                    unsubscribe: async () => {}
                },
                fallbackIntervalMs: 600000
            });
            await service.start();
            await new Promise((resolve) => setTimeout(resolve, 20));
            fail = false;
            await service.sync();
            const syncingAfterError = service.syncing;

            service.stop();
            captured.onEvent({ type: "new", order: { id: 99 } }); // sự kiện muộn sau khi dừng
            return { errors, syncingAfterError, delivered, timer: service.timer, seen: state.hasSeen("new:99") };
        }"""
    )

    assert result["errors"] == ["mất kết nối"]
    assert result["syncingAfterError"] is False
    assert result["delivered"] == []
    assert result["timer"] is None
    assert result["seen"] is False


# ---------- View và controller ----------

def test_bell_and_toasts_render_safely(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { NotificationBell } = await import("/js/views/admin/notifications/NotificationBell.js");
            const { NotificationToasts } = await import("/js/views/admin/notifications/NotificationToasts.js");
            document.body.innerHTML = '<header class="site-header"><button id="logoutButton" type="button">Đăng xuất</button></header>';
            const header = document.querySelector(".site-header");
            const log = [];
            const bell = new NotificationBell({
                onOpenOrders: () => log.push("open"), onToggleSound: () => log.push("sound"),
                onRequestPermission: () => log.push("permission"), onPanelOpened: () => log.push("opened")
            }).mount(header);
            bell.render({
                history: [{ type: "new", title: "Đơn mới <b>X</b>", detail: "<i>An</i>", at: Date.now() }],
                unread: 12, soundEnabled: true, permission: "default", connected: true
            });
            const toasts = new NotificationToasts({ onOpen: () => log.push("toast-open") }).mount();
            toasts.show({ type: "new", title: "Đơn mới <b>X</b>", detail: "chi tiết" });

            const badge = header.querySelector(".order-bell-badge");
            const out = {
                bellFirst: header.firstElementChild.classList.contains("order-bell"),
                badge: badge.textContent, injected: document.querySelectorAll("b, i:not([class])").length,
                status: header.querySelector(".order-bell-status").textContent
            };
            header.querySelector(".order-bell-button").click();
            out.panelOpen = !header.querySelector(".order-bell-panel").hidden;
            header.querySelector("[data-notification-item]").click();
            document.querySelector(".order-toast-body").click();
            header.querySelector(".order-bell-actions .order-bell-link").click();
            out.log = log;
            out.toastsLeft = document.querySelectorAll(".order-toast").length;
            return out;
        }"""
    )

    assert result["bellFirst"] is True
    assert result["badge"] == "9+"
    assert result["injected"] == 0
    assert result["status"] == "Đang nhận thông báo trực tiếp."
    assert result["panelOpen"] is True
    assert result["log"] == ["opened", "open", "toast-open", "sound"]
    assert result["toastsLeft"] == 0


def test_controller_shows_realtime_events_and_groups_bursts(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createOrderNotificationController } =
                await import("/js/controllers/admin/OrderNotificationController.js");
            localStorage.clear();
            localStorage.setItem("oncafe:notifications:me:sound", JSON.stringify("off"));
            document.body.innerHTML = '<header class="site-header"><button id="logoutButton" type="button">Đăng xuất</button></header>';

            const handlers = {};
            const statusCallbacks = [];
            const client = {
                auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
                realtime: { setAuth: () => {} },
                channel: (topic) => {
                    const channel = {
                        on: (type, filter, callback) => { handlers[filter.event] = callback; return channel; },
                        subscribe: (callback) => { statusCallbacks.push({ topic, callback }); return channel; }
                    };
                    return channel;
                },
                removeChannel: async () => {}
            };
            let opened = 0;
            let orders = [{ id: 1, status: "pending" }];
            const controller = createOrderNotificationController({
                supabaseClient: client,
                getOrders: async () => orders,
                userId: "me",
                openOrdersPage: () => { opened += 1; }
            });
            await controller.start();
            await new Promise((resolve) => setTimeout(resolve, 30)); // chờ đồng bộ nền đầu tiên
            statusCallbacks.forEach(({ callback }) => callback("SUBSCRIBED"));
            await new Promise((resolve) => setTimeout(resolve, 30));

            const order = (id) => ({ id, order_code: "ON-" + id, status: "pending", order_source: "online",
                fulfillment_method: "pickup", customer_name: "Khách", total_amount: 20000 });
            handlers.order_new({ payload: { type: "new", actor: "customer", order: order(2) } });
            handlers.order_new({ payload: { type: "new", actor: "me", order: order(3) } }); // tự lập: bỏ qua
            const afterOne = {
                toasts: [...document.querySelectorAll(".order-toast")].map((t) => t.textContent),
                badge: document.querySelector(".order-bell-badge").textContent,
                status: document.querySelector(".order-bell-status").textContent
            };

            // Mất kết nối rồi nối lại: 4 đơn phát sinh trong lúc đó được bù cùng một lượt và gộp thành một thông báo.
            orders = [4, 5, 6, 7].map((id) => ({ id, status: "pending" })).concat(orders);
            statusCallbacks.forEach(({ callback }) => callback("TIMED_OUT"));
            statusCallbacks.forEach(({ callback }) => callback("SUBSCRIBED"));
            await new Promise((resolve) => setTimeout(resolve, 50));
            const afterBurst = [...document.querySelectorAll(".order-toast")].map((t) => t.textContent);
            const history = JSON.parse(localStorage.getItem("oncafe:notifications:me:history")).length;
            controller.stop();
            return { afterOne, afterBurst, history, opened };
        }"""
    )

    assert len(result["afterOne"]["toasts"]) == 1
    assert "Đơn mới ON-2" in result["afterOne"]["toasts"][0]
    assert result["afterOne"]["badge"] == "1"
    assert result["afterOne"]["status"] == "Đang nhận thông báo trực tiếp."
    # Đợt 4 đơn bù cùng một lượt được gộp thành một thông báo nổi tóm tắt.
    assert any("4 đơn mới" in text for text in result["afterBurst"])
    assert result["history"] == 5
