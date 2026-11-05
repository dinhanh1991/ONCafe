from conftest import BASE_URL


def open_app(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")


def test_cart_rejects_out_of_stock_product(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerCartService } = await import("/js/services/CustomerCartService.js");
            const storage = {
                value: null,
                getItem() { return this.value; },
                setItem(key, value) { this.value = value; }
            };
            const cart = new CustomerCartService(storage, "out-of-stock-test");
            let error;
            try {
                cart.addProduct({ id: 4, name: "Trà đào", price: 30000, quantity: 0 });
            } catch (caught) {
                error = caught.message;
            }
            return { error, items: cart.getItems(), stored: storage.value };
        }"""
    )

    assert result == {
        "error": "Sản phẩm hiện đã hết hàng.",
        "items": [],
        "stored": None,
    }


def test_checkout_uses_server_total_creates_order_and_qr(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerCartService } = await import("/js/services/CustomerCartService.js");
            const { CustomerCheckoutController } =
                await import("/js/controllers/customer/CustomerCheckoutController.js");
            document.body.insertAdjacentHTML("beforeend", `
                <button id="checkoutButton" type="button"></button>
                <form id="checkoutForm" hidden>
                    <input name="fullName" value="  Nguyen Van A  ">
                    <input name="phone" value="0912345678">
                    <select name="fulfillmentMethod"><option value="pickup" selected>Nhận tại quán</option></select>
                    <textarea name="address">12 Duong Le Loi, Quan 1</textarea>
                    <select name="paymentMethod"><option value="qr" selected>QR</option></select>
                    <button id="submitOrderButton" type="submit">Đặt hàng</button>
                </form>
                <p id="checkoutMessage"></p>
                <p id="checkoutTotalSummary"></p>
            `);
            const storage = {
                value: null,
                getItem() { return this.value; },
                setItem(key, value) { this.value = value; }
            };
            const cart = new CustomerCartService(storage, "checkout-flow-test");
            cart.addProduct({
                id: 7,
                name: "Cà phê sữa",
                price: 30000,
                quantity: 5
            });
            const observed = { orderRequest: null, qrOrderId: null, status: [] };
            const checkoutService = {
                getCurrentUser: async () => ({ id: "customer-1" }),
                createOrder: async (request) => {
                    observed.orderRequest = request;
                    return { order_id: 42, order_code: "ONC-42", total_amount: 35000 };
                },
                createQrInfo: async (orderId) => {
                    observed.qrOrderId = orderId;
                    return {
                        url: "https://example.test/qr-confirm?token=test-token",
                        image: "data:image/png;base64,dGVzdA==",
                        expiresAt: Date.now() + 600000
                    };
                },
                getOrderPaymentState: async () => ({ payment_status: "unpaid" })
            };
            const controller = new CustomerCheckoutController({
                checkoutService,
                cartService: cart,
                getCartItems: () => cart.getItems(),
                onCartChanged: () => { observed.cartChanged = true; },
                showMenuStatus: (message, isError = false) => observed.status.push({ message, isError }),
                currencyFormatter: new Intl.NumberFormat("vi-VN", {
                    style: "currency", currency: "VND", maximumFractionDigits: 0
                })
            });
            await controller.submitOrder({ preventDefault() {} });
            controller.paymentMonitor.stop();
            const popup = document.querySelector(".menu-order-dialog-backdrop");
            const popupText = popup?.textContent || "";
            const popupHasQr = Boolean(popup?.querySelector(".customer-qr-panel img"));
            popup?.remove();
            return {
                ...observed,
                cart: cart.getItems(),
                submitDisabled: document.querySelector("#submitOrderButton").disabled,
                popupHasQr,
                popupText
            };
        }"""
    )

    assert result["orderRequest"] == {
        "fullName": "Nguyen Van A",
        "phone": "0912345678",
        "address": "12 Duong Le Loi, Quan 1",
        "paymentMethod": "qr",
        "fulfillmentMethod": "pickup",
        "items": [{"id": 7, "quantity": 1}],
    }
    assert result["qrOrderId"] == 42
    assert result["cart"] == []
    assert result["cartChanged"] is True
    assert result["submitDisabled"] is False
    assert result["popupHasQr"] is True
    assert "ONC-42" in result["popupText"]
    assert "10 phút" in result["popupText"]
    assert "35.000" in result["popupText"]
    assert "35.000" in result["popupText"]
    assert result["status"] == [
        {"message": "Đã tạo đơn ONC-42. Vui lòng thanh toán QR trong 10 phút.", "isError": False}
    ]


def test_server_stock_or_price_change_failure_keeps_cart_and_skips_qr(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerCartService } = await import("/js/services/CustomerCartService.js");
            const { CustomerCheckoutController } =
                await import("/js/controllers/customer/CustomerCheckoutController.js");
            document.body.insertAdjacentHTML("beforeend", `
                <button id="checkoutButton" type="button"></button>
                <form id="checkoutForm" hidden>
                    <input name="fullName" value="Nguyen Van A">
                    <input name="phone" value="0912345678">
                    <select name="fulfillmentMethod"><option value="pickup" selected>Nhận tại quán</option></select>
                    <textarea name="address">12 Duong Le Loi</textarea>
                    <select name="paymentMethod"><option value="qr" selected>QR</option></select>
                    <button id="submitOrderButton" type="submit">Đặt hàng</button>
                </form>
                <p id="checkoutMessage"></p>
                <p id="checkoutTotalSummary"></p>
            `);
            const storage = {
                value: null,
                getItem() { return this.value; },
                setItem(key, value) { this.value = value; }
            };
            const cart = new CustomerCartService(storage, "stock-race-test");
            cart.addProduct({ id: 7, name: "Cà phê sữa", price: 30000, quantity: 1 });
            let qrCalls = 0;
            const checkoutService = {
                getCurrentUser: async () => ({ id: "customer-1" }),
                createOrder: async () => {
                    throw new Error("Giá hoặc tồn kho sản phẩm đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.");
                },
                createQrInfo: async () => { qrCalls += 1; }
            };
            const controller = new CustomerCheckoutController({
                checkoutService,
                cartService: cart,
                getCartItems: () => cart.getItems(),
                onCartChanged: () => {},
                showMenuStatus: () => {},
                currencyFormatter: new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
            });
            await controller.submitOrder({ preventDefault() {} });
            controller.paymentMonitor.stop();
            return {
                cart: cart.getItems(),
                qrCalls,
                message: document.querySelector("#checkoutMessage").textContent,
                isError: document.querySelector("#checkoutMessage").classList
                    .contains("checkout-message-error"),
                formHidden: document.querySelector("#checkoutForm").hidden
            };
        }"""
    )

    assert result["cart"] == [
        {"id": 7, "name": "Cà phê sữa", "price": 30000, "image_url": "", "quantity": 1}
    ]
    assert result["qrCalls"] == 0
    assert "Giá hoặc tồn kho sản phẩm đã thay đổi" in result["message"]
    assert result["isError"] is True
    assert result["formHidden"] is True


def test_cancel_pending_order_prevents_qr_retry(page):
    open_app(page)

    result = page.evaluate(
        """async () => {
            const { CustomerMyOrdersService } =
                await import("/js/services/CustomerMyOrdersService.js");
            const state = { status: "pending", payment_status: "unpaid", cancelCalls: 0 };
            const repository = {
                cancelMyOrder: async (orderId) => {
                    state.cancelCalls += 1;
                    if (state.status !== "pending" || state.payment_status !== "unpaid") {
                        throw new Error("Đơn không còn đủ điều kiện để hủy.");
                    }
                    state.status = "cancelled";
                    state.stockRestored = true;
                    state.orderId = orderId;
                },
                createQrPayment: async () => {
                    if (state.status !== "pending" || state.payment_status !== "unpaid") {
                        throw new Error("Order is not eligible for QR confirmation");
                    }
                    return { token: "new-token" };
                }
            };
            const service = new CustomerMyOrdersService(repository);
            await service.cancelMyOrder(42);
            let retryError;
            try {
                await service.createQrPayment(42);
            } catch (error) {
                retryError = error.message;
            }
            return { ...state, retryError };
        }"""
    )

    assert result == {
        "status": "cancelled",
        "payment_status": "unpaid",
        "cancelCalls": 1,
        "stockRestored": True,
        "orderId": 42,
        "retryError": "Order is not eligible for QR confirmation",
    }


def test_staff_confirms_and_processes_online_order(page):
    open_app(page)
    page.evaluate(
        """async () => {
            const { OrderView } = await import("/js/views/admin/OrderView.js");
            const container = document.createElement("div");
            document.body.append(container);
            const order = {
                id: 42,
                order_code: "ONC-42",
                status: "pending",
                payment_status: "paid",
                payment_method: "qr",
                order_source: "online",
                fulfillment_method: "pickup",
                total_amount: 35000,
                created_at: new Date().toISOString(),
                customer_name: "Nguyen Van A",
                items: []
            };
            window.__orderStatusCalls = [];
            new OrderView(container, {
                onUpdateStatus: async (id, status) => {
                    window.__orderStatusCalls.push([id, status]);
                    order.status = status;
                },
                onUpdatePayment: async () => {},
                onMarkArrived: async () => {},
                onRefresh: async () => [order]
            }).render([order]);
        }"""
    )

    page.locator('[data-order-action="confirmed"]').click()
    page.locator("[data-dialog-confirm]").click()
    page.locator('[data-order-action="preparing"]').wait_for()
    page.locator('[data-order-action="preparing"]').click()
    page.locator("[data-dialog-confirm]").click()
    page.locator('[data-order-action="ready_for_pickup"]').wait_for()

    assert page.evaluate("window.__orderStatusCalls") == [
        ["42", "confirmed"],
        ["42", "preparing"],
    ]
    assert page.locator("[data-order-list]").inner_text().find("Đang pha chế") >= 0


def test_qr_confirmation_page_expires_without_request(page):
    calls = []
    page.route(
        "**/supabase-js@2*",
        lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            headers={"Access-Control-Allow-Origin": "*"},
            body="""export function createClient() {
                return { functions: { invoke: async (...args) => {
                    window.__qrInvocations = (window.__qrInvocations || 0) + 1;
                    return { data: { confirmed: true, order_code: "ONC-42" }, error: null };
                } } };
            }""",
        ),
    )
    page.goto(f"{BASE_URL}/pages/customer/qr-confirm.html?token={'a' * 64}&expires=1")

    assert page.locator("#feedback").inner_text() == (
        "Mã QR đã hết hạn sau 10 phút. Vui lòng tạo mã mới trong mục Đơn hàng của tôi."
    )
    assert page.locator("#confirmButton").is_disabled()
    assert page.evaluate("window.__qrInvocations || 0") == 0


def test_qr_confirmation_button_prevents_double_payment_request(page):
    page.route(
        "**/supabase-js@2*",
        lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            headers={"Access-Control-Allow-Origin": "*"},
            body="""export function createClient() {
                return { functions: { invoke: async (...args) => {
                    window.__qrInvocations = (window.__qrInvocations || 0) + 1;
                    await new Promise((resolve) => setTimeout(resolve, 150));
                    return { data: { confirmed: true, order_code: "ONC-42" }, error: null };
                } } };
            }""",
        ),
    )
    page.goto(f"{BASE_URL}/pages/customer/qr-confirm.html?token={'b' * 64}")

    button = page.locator("#confirmButton")
    button.click()
    button.click(force=True)
    page.locator("#successOverlay.show").wait_for()

    assert page.evaluate("window.__qrInvocations || 0") == 1
    assert page.locator("#successOrder").inner_text() == "Mã đơn hàng: ONC-42"


def test_payment_monitor_does_not_confirm_payment_twice(page):
    page.goto(f"{BASE_URL}/pages/auth/login.html")

    result = page.evaluate(
        """async () => {
            const { CustomerPaymentMonitor } =
                await import("/js/controllers/customer/CustomerPaymentMonitor.js");
            let paidCount = 0;
            const monitor = new CustomerPaymentMonitor({
                getPaymentState: async (id) => ({
                    id,
                    payment_status: "paid",
                    status: "confirmed"
                }),
                onPaid: () => { paidCount += 1; }
            });
            monitor.start(42);
            await monitor.check();
            await monitor.check();
            monitor.stop();
            return { paidCount, isStopped: monitor.timer === null };
        }"""
    )

    assert result == {"paidCount": 1, "isStopped": True}
