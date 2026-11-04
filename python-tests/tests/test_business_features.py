from conftest import BASE_URL


def open_app(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")


def test_product_service_add_update_and_delete(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { ProductService } = await import("/js/services/ProductService.js");
            const calls = [];
            let storedProduct = null;
            const repository = {
                findById: async () => storedProduct,
                save: async (product) => {
                    storedProduct = {
                        id: 12,
                        name: product.name,
                        price: product.price,
                        category: product.category,
                        quantity: product.quantity,
                        imageUrl: product.imageUrl,
                        status: product.status
                    };
                    calls.push(["add", storedProduct.name]);
                    return storedProduct;
                },
                update: async (id, product) => {
                    storedProduct = { id, ...product };
                    calls.push(["update", id, storedProduct.name, storedProduct.quantity]);
                    return storedProduct;
                },
                delete: async (id) => {
                    calls.push(["delete", id]);
                    storedProduct = null;
                    return true;
                }
            };
            const service = new ProductService(repository);
            const added = await service.addProduct({
                name: "  Bạc xỉu  ",
                price: "35000",
                category: "  Cà phê ",
                quantity: "8"
            });
            const updated = await service.updateProduct(added.id, {
                name: "Bạc xỉu đá",
                price: "40000",
                category: "Cà phê",
                quantity: "5"
            });
            await service.deleteProduct(updated.id);
            return { calls, storedProduct };
        }"""
    )

    assert result == {
        "calls": [
            ["add", "Bạc xỉu"],
            ["update", 12, "Bạc xỉu đá", 5],
            ["delete", 12],
        ],
        "storedProduct": None,
    }


def test_product_view_searches_by_name_and_category(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { ProductView } = await import("/js/views/admin/ProductView.js");
            const container = document.createElement("div");
            document.body.append(container);
            const view = new ProductView(container, {
                onSave: async (product) => product,
                onDelete: async () => {}
            });
            view.render([
                { id: 1, name: "Bạc xỉu", category: "Cà phê", price: 35000, quantity: 4, status: "active" },
                { id: 2, name: "Trà đào", category: "Trà trái cây", price: 30000, quantity: 6, status: "active" },
                { id: 3, name: "Trà sen", category: "Trà nóng", price: 25000, quantity: 3, status: "inactive" }
            ]);
            const search = container.querySelector("[data-product-search]");
            search.value = "TRÀ";
            search.dispatchEvent(new Event("input", { bubbles: true }));
            const byName = [...container.querySelectorAll("[data-product-list] tr td:nth-child(2)")]
                .map((cell) => cell.textContent.trim());
            search.value = "trái cây";
            search.dispatchEvent(new Event("input", { bubbles: true }));
            const byCategory = [...container.querySelectorAll("[data-product-list] tr td:nth-child(2)")]
                .map((cell) => cell.textContent.trim());
            return { byName, byCategory };
        }"""
    )

    assert result == {"byName": ["Trà đào", "Trà sen"], "byCategory": ["Trà đào"]}


def test_order_service_creates_counter_order_and_updates_status(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { OrderService } = await import("/js/services/OrderService.js");
            const calls = [];
            const repository = {
                createCounterOrder: async (order) => {
                    calls.push(["create", order.customerName, order.paymentMethod]);
                    return { id: 25, order_code: "ON-25", total_amount: 70000 };
                },
                updateStatus: async (id, status) => calls.push(["status", id, status])
            };
            const service = new OrderService(repository);
            const order = await service.createCounterOrder({
                customerName: "Khách thử",
                paymentMethod: "qr",
                items: [{ product_id: 3, quantity: 2 }]
            });
            await service.updateStatus(order.id, "preparing");
            let invalidStatus;
            try {
                await service.updateStatus(order.id, "unknown");
            } catch (error) {
                invalidStatus = error.message;
            }
            return { order, calls, invalidStatus };
        }"""
    )

    assert result["order"] == {"id": 25, "order_code": "ON-25", "total_amount": 70000}
    assert result["calls"] == [
        ["create", "Khách thử", "qr"],
        ["status", 25, "preparing"],
    ]
    assert result["invalidStatus"] == "Trạng thái đơn hàng không hợp lệ."


def test_qr_expiry_is_capped_at_ten_minutes(page):
    open_app(page)
    page.route(
        "**/qrcode@1.5.4",
        lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body='export default { toDataURL: async (url) => "data:image/png;base64," + btoa(url) };',
        ),
    )

    result = page.evaluate(
        """async () => {
            const { CustomerQrPaymentService } =
                await import("/js/services/CustomerQrPaymentService.js");
            const service = new CustomerQrPaymentService();
            const realNow = Date.now;
            const startedAt = realNow();
            try {
                Date.now = () => startedAt;
                const info = await service.createQrInfo(
                    { token: "qr-token", expires_at: new Date(startedAt + 60 * 60 * 1000).toISOString() },
                    window.location.href
                );
                return {
                    startedAt,
                    expiresAt: info.expiresAt,
                    url: info.url,
                    image: info.image
                };
            } finally {
                Date.now = realNow;
            }
        }"""
    )

    assert 599_000 <= result["expiresAt"] - result["startedAt"] <= 600_000
    assert "token=qr-token" in result["url"]
    assert "expires=" in result["url"]
    assert result["image"].startswith("data:image/png;base64,")


def test_qr_service_rejects_missing_token(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerQrPaymentService } =
                await import("/js/services/CustomerQrPaymentService.js");
            try {
                await new CustomerQrPaymentService().createQrInfo(
                    { expires_at: new Date(Date.now() + 60000).toISOString() },
                    window.location.href
                );
                return null;
            } catch (error) {
                return error.message;
            }
        }"""
    )

    assert result == "Không nhận được mã xác nhận thanh toán."


def test_qr_expiry_respects_earlier_server_expiration(page):
    open_app(page)
    page.route(
        "**/qrcode@1.5.4",
        lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body='export default { toDataURL: async (url) => "data:image/png;base64," + btoa(url) };',
        ),
    )

    result = page.evaluate(
        """async () => {
            const { CustomerQrPaymentService } =
                await import("/js/services/CustomerQrPaymentService.js");
            const realNow = Date.now;
            const startedAt = realNow();
            try {
                Date.now = () => startedAt;
                const info = await new CustomerQrPaymentService().createQrInfo(
                    { token: "short-lived-token", expires_at: new Date(startedAt + 120000).toISOString() },
                    window.location.href
                );
                return info.expiresAt - startedAt;
            } finally {
                Date.now = realNow;
            }
        }"""
    )

    assert result == 120_000


def test_qr_payment_monitor_confirms_paid_order(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerPaymentMonitor } =
                await import("/js/controllers/customer/CustomerPaymentMonitor.js");
            let confirmedOrder = null;
            const monitor = new CustomerPaymentMonitor({
                getPaymentState: async (id) => ({ id, payment_status: "paid", status: "confirmed" }),
                onPaid: (order) => { confirmedOrder = order; },
                intervalMs: 60000
            });
            monitor.start(27);
            await monitor.check();
            const stopped = monitor.timer === null && monitor.orderId === null;
            monitor.stop();
            return { confirmedOrder, stopped };
        }"""
    )

    assert result == {
        "confirmedOrder": {"id": 27, "payment_status": "paid", "status": "confirmed"},
        "stopped": True,
    }


def test_staff_role_permissions_cover_admin_cashier_seller_and_customer(page):
    open_app(page)

    permissions = page.evaluate(
        """async () => {
            const { isSectionAllowed } = await import("/js/utils/admin/AdminNavigation.js");
            const sections = [
                "drinks", "employees", "counter-order", "orders",
                "revenue-summary", "revenue", "popular"
            ];
            return Object.fromEntries(
                ["admin", "cashier", "seller", "customer"].map((role) => [
                    role,
                    Object.fromEntries(sections.map((section) => [
                        section,
                        isSectionAllowed(role, section)
                    ]))
                ])
            );
        }"""
    )

    assert permissions == {
        "admin": {
            "drinks": True,
            "employees": True,
            "counter-order": True,
            "orders": True,
            "revenue-summary": True,
            "revenue": True,
            "popular": True,
        },
        "cashier": {
            "drinks": False,
            "employees": False,
            "counter-order": False,
            "orders": True,
            "revenue-summary": True,
            "revenue": True,
            "popular": False,
        },
        "seller": {
            "drinks": True,
            "employees": False,
            "counter-order": True,
            "orders": True,
            "revenue-summary": False,
            "revenue": False,
            "popular": True,
        },
        "customer": {
            "drinks": False,
            "employees": False,
            "counter-order": False,
            "orders": False,
            "revenue-summary": False,
            "revenue": False,
            "popular": False,
        },
    }


def test_cashier_order_view_hides_order_mutations(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { OrderView } = await import("/js/views/admin/OrderView.js");
            const container = document.createElement("div");
            document.body.append(container);
            const view = new OrderView(container, {
                readOnly: true,
                onUpdateStatus: null,
                onUpdatePayment: null,
                onMarkArrived: null,
                onRefresh: async () => []
            });
            view.render([{
                id: 8,
                order_code: "ON-8",
                status: "pending",
                payment_status: "unpaid",
                payment_method: "cash",
                total_amount: 50000,
                created_at: "2026-11-04T10:00:00Z",
                customer_name: "Khách thử",
                items: []
            }]);
            return {
                statusActions: container.querySelectorAll("[data-order-action]").length,
                paymentActions: container.querySelectorAll("[data-payment-action]").length,
                displayedOrder: container.querySelector("[data-order-list]").textContent.includes("ON-8")
            };
        }"""
    )

    assert result == {"statusActions": 0, "paymentActions": 0, "displayedOrder": True}


def test_revenue_report_renders_metrics_and_filters_by_period(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { RevenueReportView } =
                await import("/js/views/admin/RevenueReportView.js");
            const container = document.createElement("div");
            document.body.append(container);
            const calls = [];
            const view = new RevenueReportView(container, {
                onLoad: async (period, anchorDate) => {
                    calls.push([period, anchorDate]);
                    return {
                        summary: {
                            net_revenue: 250000,
                            paid_amount: 300000,
                            refunded_amount: 50000,
                            paid_orders: 4
                        },
                        buckets: [{
                            label: "09:00",
                            paid_orders: 2,
                            paid_amount: 180000,
                            refunded_amount: 30000,
                            net_revenue: 150000
                        }]
                    };
                }
            });
            view.anchorDate = "2026-11-04";
            view.updatePeriodLabel();
            await view.load();
            const initialMetrics = [...container.querySelectorAll("[data-revenue-summary] strong")]
                .map((node) => node.textContent);
            const bucketRow = [...container.querySelectorAll("[data-revenue-rows] tr td")]
                .map((cell) => cell.textContent);
            const period = container.querySelector("[data-revenue-period]");
            period.value = "month";
            period.dispatchEvent(new Event("change", { bubbles: true }));
            const date = container.querySelector("[data-revenue-date]");
            date.value = "2026-10-15";
            date.dispatchEvent(new Event("change", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 0));
            await view.load();
            return {
                calls,
                initialMetrics,
                bucketRow,
                periodHeading: container.querySelector("[data-revenue-bucket-heading]").textContent,
                periodLabel: container.querySelector("[data-revenue-period-label]").textContent
            };
        }"""
    )

    assert result["initialMetrics"] == ["250.000 ₫", "300.000 ₫", "50.000 ₫", "4 đơn"]
    assert result["bucketRow"] == ["09:00", "2", "180.000 ₫", "30.000 ₫", "150.000 ₫"]
    assert result["periodHeading"] == "Ngày"
    assert "Tháng 10/2026" in result["periodLabel"]
    assert ["month", "2026-10-15"] in result["calls"]
    assert ["month", "2026-09-01"] in result["calls"]
