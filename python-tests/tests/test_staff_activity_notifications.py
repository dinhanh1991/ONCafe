from conftest import BASE_URL


def open_app(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")


def test_staff_activity_model_creates_product_and_employee_notifications(page):
    open_app(page)
    result = page.evaluate(
        """async () => {
            const { createStaffActivityNotification } =
                await import("/js/models/StaffActivityNotification.js");
            const product = createStaffActivityNotification({
                type: "product_updated", event_id: "event-1", actor: "admin-1",
                entity: { id: 12, name: "Cà phê sữa", quantity: 8 },
                changes_summary: "Tồn kho: 8"
            });
            const employee = createStaffActivityNotification({
                type: "employee_created", event_id: "event-2", actor: "admin-1",
                entity: { id: "user-2", full_name: "Nhân viên A", role: "seller" }
            });
            return { product, employee };
        }"""
    )
    assert result["product"]["category"] == "products"
    assert result["product"]["title"] == "Sản phẩm được cập nhật: Cà phê sữa"
    assert "Tồn kho: 8" in result["product"]["detail"]
    assert result["employee"]["category"] == "employees"
    assert result["employee"]["actor"] == "admin-1"
    assert result["employee"]["includeActor"] is True


def test_staff_activity_model_rejects_unknown_event_or_missing_entity(page):
    open_app(page)
    result = page.evaluate(
        """async () => {
            const { createStaffActivityNotification } =
                await import("/js/models/StaffActivityNotification.js");
            return {
                unknown: createStaffActivityNotification({ type: "employee_deleted", entity: { id: "u" } }),
                missing: createStaffActivityNotification({ type: "employee_created", entity: {} })
            };
        }"""
    )
    assert result == {"unknown": None, "missing": None}


def test_staff_activity_service_includes_creator_and_deduplicates(page):
    open_app(page)
    result = page.evaluate(
        """async () => {
            const { StaffActivityNotificationService } =
                await import("/js/services/StaffActivityNotificationService.js");
            const { NotificationStateRepository } =
                await import("/js/repositories/NotificationStateRepo.js");
            localStorage.clear();
            const delivered = [];
            const stateRepository = new NotificationStateRepository({ userId: "admin-1" });
            const service = new StaffActivityNotificationService({
                realtimeRepository: {
                    subscribe: async ({ onEvent }) => {
                        const payload = {
                            type: "employee_created", event_id: "evt-1", actor: "admin-1",
                            entity: { id: "employee-2", full_name: "Nhân viên B", role: "cashier" }
                        };
                        onEvent(payload);
                        onEvent(payload);
                    },
                    unsubscribe: async () => {}
                },
                stateRepository,
                onNotify: (items) => delivered.push(...items)
            });
            await service.start();
            service.stop();
            return delivered.map((item) => ({ key: item.key, actor: item.actor, category: item.category }));
        }"""
    )
    assert result == [{
        "key": "employee_created:employee-2:evt-1",
        "actor": "admin-1",
        "category": "employees"
    }]


def test_staff_activity_repository_skips_product_channel_for_cashier(page):
    open_app(page)
    result = page.evaluate(
        """async () => {
            const { StaffActivityRealtimeRepository } =
                await import("/js/repositories/StaffActivityRealtimeRepo.js");
            const topics = [];
            const events = [];
            const client = {
                auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) },
                realtime: { setAuth: () => {} },
                channel: (topic) => {
                    topics.push(topic);
                    const channel = {
                        on: (type, filter) => { events.push(filter.event); return channel; },
                        subscribe: () => channel
                    };
                    return channel;
                },
                removeChannel: async () => {}
            };
            const repository = new StaffActivityRealtimeRepository({ client });
            await repository.subscribe({ onEvent: () => {}, onStatusChange: () => {}, includeProducts: false });
            await repository.unsubscribe();
            return { topics, events };
        }"""
    )
    assert result["topics"] == ["oncafe:staff-orders"]
    assert result["events"] == ["employee_created"]
