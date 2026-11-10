from conftest import BASE_URL


def open_app(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")


# ---------- Model và bộ so sánh (hàm thuần) ----------

def test_notification_model_builds_text_and_rejects_invalid_input(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createOrderNotification, createNotificationKey } =
                await import("/js/models/StaffNotification.js");
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


def test_realtime_repository_listens_on_the_role_channel_with_auth(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { StaffRealtimeRepository, staffTopicFor } =
                await import("/js/repositories/StaffRealtimeRepo.js");
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
            const repo = new StaffRealtimeRepository({ client });
            await repo.subscribe({ role: "seller", onEvent: (p) => received.push(p), onStatusChange: (s) => statuses.push(s) });
            handlers["*"]({ payload: { type: "new", order: { id: 1 } } });
            handlers["*"]({ payload: { type: "menu_created", product: { id: 2, name: "Cà phê" } } });
            statusCallback("SUBSCRIBED");
            await repo.unsubscribe();

            let rejected = [];
            for (const role of ["customer", undefined, "../admin"]) {
                try { await new StaffRealtimeRepository({ client }).subscribe({ role }); rejected.push(false); }
                catch { rejected.push(true); }
            }
            return { calls, received, statuses, rejected, cashier: staffTopicFor("cashier") };
        }"""
    )

    assert result["calls"] == [
        ["setAuth", "tok-123"],
        ["channel", "oncafe:role:seller", {"config": {"private": True}}],
        ["on", "broadcast", "*"],
        ["subscribe"],
        ["remove"],
    ]
    assert [item["type"] for item in result["received"]] == ["new", "menu_created"]
    assert result["statuses"] == ["SUBSCRIBED"]
    assert result["rejected"] == [True, True, True]  # chỉ nhân viên mới có kênh
    assert result["cashier"] == "oncafe:role:cashier"


# ---------- Service ----------

SERVICE_SETUP = """
    const { StaffNotificationService } = await import("/js/services/StaffNotificationService.js");
    const { NotificationStateRepository } = await import("/js/repositories/NotificationStateRepo.js");
    localStorage.clear();
    const make = (overrides = {}) => {
        const delivered = [];
        const connection = [];
        const state = new NotificationStateRepository({ userId: "me" });
        const service = new StaffNotificationService({
            realtimeRepository: { subscribe: async () => {}, unsubscribe: async () => {} },
            getOrders: async () => [],
            stateRepository: state,
            currentUserId: "me",
            role: "seller",
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
                onOpenNotification: (item) => log.push("open:" + item.title), onToggleSound: () => log.push("sound"),
                onRequestPermission: () => log.push("permission"), onPanelOpened: () => log.push("opened")
            }).mount(header);
            bell.render({
                history: [{ type: "new", title: "Đơn mới <b>X</b>", detail: "<i>An</i>", at: Date.now() }],
                unread: 12, soundEnabled: true, permission: "default", connected: true
            });
            const toasts = new NotificationToasts({ onOpen: (n) => log.push("toast:" + n.title) }).mount();
            toasts.show({ type: "new", title: "Đơn mới <b>X</b>", detail: "chi tiết" });

            const badge = header.querySelector(".order-bell-badge");
            const out = {
                bellFirst: header.firstElementChild.classList.contains("order-bell"),
                badge: badge.textContent, injected: document.querySelectorAll("b, i:not([class])").length,
                status: header.querySelector(".order-bell-status").textContent
            };
            header.querySelector(".order-bell-button").click();
            out.panelOpen = !header.querySelector(".order-bell-panel").hidden;
            header.querySelector("[data-notification-index]").click();
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
    assert result["log"] == ["opened", "open:Đơn mới <b>X</b>", "toast:Đơn mới <b>X</b>", "sound"]
    assert result["toastsLeft"] == 0


def test_controller_shows_realtime_events_and_groups_bursts(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createStaffNotificationController } =
                await import("/js/controllers/admin/StaffNotificationController.js");
            localStorage.clear();
            localStorage.setItem("oncafe:notifications:me:sound", JSON.stringify("off"));
            document.body.innerHTML = '<header class="site-header"><button id="logoutButton" type="button">Đăng xuất</button></header>';

            const handlers = {};
            let statusCallback = null;
            const client = {
                auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
                realtime: { setAuth: () => {} },
                channel: () => {
                    const channel = {
                        on: (type, filter, callback) => { handlers[filter.event] = callback; return channel; },
                        subscribe: (callback) => { statusCallback = callback; return channel; }
                    };
                    return channel;
                },
                removeChannel: async () => {}
            };
            const opened = [];
            let orders = [{ id: 1, status: "pending" }];
            const controller = createStaffNotificationController({
                supabaseClient: client,
                getOrders: async () => orders,
                userId: "me",
                role: "seller",
                openSection: (section) => { opened.push(section); }
            });
            await controller.start();
            await new Promise((resolve) => setTimeout(resolve, 30)); // chờ đồng bộ nền đầu tiên
            statusCallback("SUBSCRIBED");
            await new Promise((resolve) => setTimeout(resolve, 30));

            const order = (id) => ({ id, order_code: "ON-" + id, status: "pending", order_source: "online",
                fulfillment_method: "pickup", customer_name: "Khách", total_amount: 20000 });
            handlers["*"]({ payload: { type: "new", actor: "customer", order: order(2) } });
            handlers["*"]({ payload: { type: "new", actor: "me", order: order(3) } }); // tự lập: bỏ qua
            const afterOne = {
                toasts: [...document.querySelectorAll(".order-toast")].map((t) => t.textContent),
                badge: document.querySelector(".order-bell-badge").textContent,
                status: document.querySelector(".order-bell-status").textContent
            };

            // Mất kết nối rồi nối lại: 4 đơn phát sinh trong lúc đó được bù cùng một lượt và gộp thành một thông báo.
            orders = [4, 5, 6, 7].map((id) => ({ id, status: "pending" })).concat(orders);
            statusCallback("TIMED_OUT");
            statusCallback("SUBSCRIBED");
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


# ---------- Thông báo đồ uống và nhân viên mới ----------

def test_model_builds_menu_and_employee_notifications(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createNotificationFromPayload } = await import("/js/models/StaffNotification.js");
            const actor = { actor: "u1", actor_name: "Lan", actor_role: "seller" };
            const created = createNotificationFromPayload({ type: "menu_created", event_id: "e1", product: { id: 1, name: "Cà phê muối" }, ...actor });
            const updated = createNotificationFromPayload({ type: "menu_updated", event_id: "e2", product: { id: 1, name: "Cà phê muối" },
                changed: ["price", "image", "bogus"], ...actor });
            const deleted = createNotificationFromPayload({ type: "menu_deleted", event_id: "e3", product: { id: 1, name: "Cà phê muối" } });
            const joined = createNotificationFromPayload({ type: "employee_joined", event_id: "e4",
                employee: { id: "n1", full_name: "  An  ", role: "cashier" }, actor: null, actor_name: "Chủ quán", actor_role: "admin" });
            const joinedNoName = createNotificationFromPayload({ type: "employee_joined", employee: { id: "n2", full_name: "", role: "seller" } });
            const brief = (n) => n && { key: n.key, category: n.category, target: n.target, title: n.title, detail: n.detail };
            return {
                created: brief(created), updated: brief(updated), deleted: brief(deleted),
                joined: brief(joined), joinedNoName: brief(joinedNoName),
                unknown: createNotificationFromPayload({ type: "something_else" }),
                noProduct: createNotificationFromPayload({ type: "menu_created", event_id: "x" }),
                noEmployee: createNotificationFromPayload({ type: "employee_joined" }),
                nothing: createNotificationFromPayload(undefined)
            };
        }"""
    )

    assert result["created"] == {
        "key": "menu_created:e1", "category": "menu", "target": "drinks",
        "title": "Đã thêm đồ uống: Cà phê muối", "detail": "Bởi Lan (Nhân viên bán hàng)",
    }
    assert result["updated"]["title"] == "Đã sửa đồ uống: Cà phê muối"
    assert result["updated"]["detail"] == "Bởi Lan (Nhân viên bán hàng) · Đã đổi: giá, ảnh"
    assert result["deleted"]["title"] == "Đã xóa đồ uống: Cà phê muối"
    assert result["deleted"]["detail"] == "Bởi hệ thống"
    assert result["joined"] == {
        "key": "employee_joined:e4", "category": "team", "target": "employees",
        "title": "An đã tham gia", "detail": "Vai trò: Thu ngân · Thêm bởi Chủ quán",
    }
    assert result["joinedNoName"]["title"] == "Nhân viên mới đã tham gia"
    assert result["unknown"] is None
    assert result["noProduct"] is None
    assert result["noEmployee"] is None
    assert result["nothing"] is None


def test_service_delivers_each_menu_edit_but_not_duplicates_or_own_actions(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            const { service, delivered } = make();
            const edit = (eventId, actor) => ({ type: "menu_updated", event_id: eventId, actor,
                product: { id: 5, name: "Trà đào" }, changed: ["price"] });

            service.handleRealtimeEvent(edit("e1", "other"));
            service.handleRealtimeEvent(edit("e1", "other")); // cùng sự kiện gửi lặp: bỏ qua
            service.handleRealtimeEvent(edit("e2", "other")); // lần sửa thứ hai của CÙNG đồ uống: vẫn báo
            service.handleRealtimeEvent(edit("e3", "me"));    // chính mình sửa: bỏ qua
            service.handleRealtimeEvent({ type: "employee_joined", event_id: "e4", actor: null,
                employee: { id: "n1", full_name: "An", role: "seller" } });
            service.handleRealtimeEvent({ type: "future_event", event_id: "e5" }); // loại chưa biết: bỏ qua
            return delivered;
        }"""
    )

    assert result == [["menu_updated:e1"], ["menu_updated:e2"], ["employee_joined:e4"]]


def test_service_subscribes_with_its_role_and_reports_channel_failures(page):
    open_app(page)

    result = page.evaluate(
        "async () => {" + SERVICE_SETUP + """
            const errors = [];
            let subscribedRole = null;
            const { service, connection } = make({
                role: "cashier",
                onError: (error) => errors.push(error.message),
                realtimeRepository: {
                    subscribe: async ({ role }) => { subscribedRole = role; },
                    unsubscribe: async () => {}
                },
                fallbackIntervalMs: 600000
            });
            await service.start();
            const denied = { message: "Unauthorized: You do not have permissions to read from this Channel topic" };
            service.handleStatus("CHANNEL_ERROR", service.generation, denied);
            service.handleStatus("CHANNEL_ERROR", service.generation, denied); // thư viện thử nối lại: không ghi lặp
            service.handleStatus("TIMED_OUT", service.generation);
            service.handleStatus("SUBSCRIBED", service.generation);
            service.handleStatus("CHANNEL_ERROR", service.generation, denied); // nối được rồi lại lỗi: ghi lại
            await new Promise((resolve) => setTimeout(resolve, 20));
            service.stop();
            return { subscribedRole, errors, connection };
        }"""
    )

    assert result["subscribedRole"] == "cashier"
    assert result["errors"] == [
        "Kênh thông báo nhân viên chưa kết nối (CHANNEL_ERROR): Unauthorized: You do not have permissions to read from this Channel topic",
        "Kênh thông báo nhân viên chưa kết nối (TIMED_OUT)",
        "Kênh thông báo nhân viên chưa kết nối (CHANNEL_ERROR): Unauthorized: You do not have permissions to read from this Channel topic",
    ]
    assert result["connection"] == [True, False]


def test_controller_shows_menu_and_team_notifications_and_opens_the_right_page(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createStaffNotificationController } =
                await import("/js/controllers/admin/StaffNotificationController.js");
            localStorage.clear();
            localStorage.setItem("oncafe:notifications:me:sound", JSON.stringify("off"));
            document.body.innerHTML = '<header class="site-header"><button id="logoutButton" type="button">Đăng xuất</button></header>';

            const handlers = {};
            const client = {
                auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
                realtime: { setAuth: () => {} },
                channel: () => {
                    const channel = {
                        on: (type, filter, callback) => { handlers[filter.event] = callback; return channel; },
                        subscribe: () => channel
                    };
                    return channel;
                },
                removeChannel: async () => {}
            };
            const opened = [];
            const controller = createStaffNotificationController({
                supabaseClient: client, getOrders: async () => [], userId: "me", role: "admin",
                openSection: (section) => opened.push(section)
            });
            await controller.start();
            await new Promise((resolve) => setTimeout(resolve, 30));
            const send = (payload) => handlers["*"]({ payload });
            const toastTexts = () => [...document.querySelectorAll(".order-toast")].map((t) => t.textContent);

            send({ type: "menu_created", event_id: "m1", actor: "seller-1", actor_name: "Lan", actor_role: "seller",
                product: { id: 1, name: "Trà đào" } });
            send({ type: "employee_joined", event_id: "t1", actor: null,
                employee: { id: "n1", full_name: "Minh", role: "cashier" } });
            const afterTwo = toastTexts();
            const classes = [...document.querySelectorAll(".order-toast")].map((t) => t.className);

            document.querySelectorAll(".order-toast-body")[0].click(); // đồ uống -> trang đồ uống
            document.querySelectorAll(".order-toast-body")[0].click(); // nhân viên mới -> trang nhân viên
            controller.stop();
            return { afterTwo, classes, opened, badge: document.querySelector(".order-bell-badge").textContent };
        }"""
    )

    assert len(result["afterTwo"]) == 2
    assert "Đã thêm đồ uống: Trà đào" in result["afterTwo"][0]
    assert "Bởi Lan (Nhân viên bán hàng)" in result["afterTwo"][0]
    assert "Minh đã tham gia" in result["afterTwo"][1]
    assert "is-menu" in result["classes"][0]
    assert "is-team" in result["classes"][1]
    assert result["opened"] == ["drinks", "employees"]
    assert result["badge"] == "2"


def test_controller_summary_mixes_all_notification_kinds(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { createStaffNotificationController } =
                await import("/js/controllers/admin/StaffNotificationController.js");
            localStorage.clear();
            localStorage.setItem("oncafe:notifications:me:sound", JSON.stringify("off"));
            document.body.innerHTML = '<header class="site-header"></header>';
            let orders = [{ id: 1, status: "pending" }];
            let statusCallback = null;
            const client = {
                auth: { getSession: async () => ({ data: { session: null } }) },
                realtime: { setAuth: () => {} },
                channel: () => {
                    const channel = { on: () => channel, subscribe: (cb) => { statusCallback = cb; return channel; } };
                    return channel;
                },
                removeChannel: async () => {}
            };
            const opened = [];
            const controller = createStaffNotificationController({
                supabaseClient: client, getOrders: async () => orders, userId: "me", role: "seller",
                openSection: (section) => opened.push(section)
            });
            await controller.start();
            await new Promise((resolve) => setTimeout(resolve, 30));
            statusCallback("SUBSCRIBED");
            await new Promise((resolve) => setTimeout(resolve, 30));

            // Đồng bộ bù sau khi kết nối lại: 4 đơn mới cùng lúc -> gộp thành một thông báo.
            orders = [2, 3, 4, 5].map((id) => ({ id, status: "pending" })).concat(orders);
            statusCallback("TIMED_OUT");
            statusCallback("SUBSCRIBED");
            await new Promise((resolve) => setTimeout(resolve, 50));
            const toasts = [...document.querySelectorAll(".order-toast")].map((t) => t.textContent);
            document.querySelector(".order-toast-body").click();
            controller.stop();
            return { toasts, opened };
        }"""
    )

    assert len(result["toasts"]) == 1
    assert "Có cập nhật mới" in result["toasts"][0]
    assert "4 đơn mới" in result["toasts"][0]
    assert result["opened"] == ["orders"]
