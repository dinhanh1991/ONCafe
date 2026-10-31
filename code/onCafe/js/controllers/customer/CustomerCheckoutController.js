import { CustomerCheckoutView } from "../../views/customer/CustomerCheckoutView.js";
import { ValidationUtils } from "../../validators/ValidationUtils.js";
import { OrderValidator } from "../../validators/OrderValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";
import { showPaymentConfirmedPopup, showOrderSuccessPopup } from "../../ui/customer/OrderDialogs.js";
import { CustomerPaymentMonitor } from "./CustomerPaymentMonitor.js";

/**
 * CustomerCheckoutController
 * Điều phối luồng checkout của khách hàng.
 * Không trực tiếp truy cập Supabase; dữ liệu được xử lý qua CustomerCheckoutService.
 */
export class CustomerCheckoutController {
    constructor({
        checkoutService,
        cartService,
        getCartItems,
        onCartChanged,
        showMenuStatus,
        currencyFormatter
    }) {
        this.checkoutService = checkoutService;
        this.cartService = cartService;
        this.getCartItems = getCartItems;
        this.onCartChanged = onCartChanged;
        this.showMenuStatus = showMenuStatus;
        this.currencyFormatter = currencyFormatter;

        this.checkoutButton = document.querySelector("#checkoutButton");
        this.checkoutForm = document.querySelector("#checkoutForm");
        this.checkoutMessage = document.querySelector("#checkoutMessage");

        this.checkoutView = new CustomerCheckoutView({
            form: this.checkoutForm,
            message: this.checkoutMessage,
            totalSummary: document.querySelector("#checkoutTotalSummary"),
            currencyFormatter: this.currencyFormatter
        });

        this.paymentMonitor = new CustomerPaymentMonitor({
            getPaymentState: (orderId) => this.checkoutService.getOrderPaymentState(orderId),
            onPaid: (order) => showPaymentConfirmedPopup(order, this.currencyFormatter),
            onEnded: () => this.showMessage(
                "Đơn hàng đã kết thúc trước khi thanh toán được xác nhận. Vui lòng kiểm tra mục Đơn hàng của tôi.",
                true
            )
        });

        ValidationUI.bind(this.checkoutForm);
        this.checkoutView.bindFulfillmentChange(() => this.updateSummary());
        this.bindEvents();

        window.addEventListener("beforeunload", () => {
            this.paymentMonitor.stop();
        });
    }

    bindEvents() {
        if (this.checkoutButton && this.checkoutForm) {
            this.checkoutButton.addEventListener("click", () => {
                void this.openCheckout();
            });
        }

        this.checkoutForm?.addEventListener("submit", (event) => {
            void this.submitOrder(event);
        });
    }

    getCart() {
        return this.getCartItems();
    }

    updateSummary() {
        this.checkoutView.updateSummary(this.cartService.getSubtotal());
    }

    showMessage(message, isError = false) {
        this.checkoutView.showMessage(message, isError);
    }

    async openCheckout() {
        if (this.getCart().length === 0) {
            this.showMenuStatus("Giỏ hàng đang trống. Hãy thêm ít nhất một đồ uống trước.", true);
            return;
        }

        let user;
        try {
            user = await this.checkoutService.getCurrentUser();
        } catch {
            user = null;
        }

        if (!user) {
            this.showMenuStatus("Bạn cần đăng nhập trước khi đặt hàng. Hãy đăng nhập rồi quay lại thực đơn.", true);
            window.location.href = "../auth/login.html?redirect=menu";
            return;
        }

        const profile = await this.checkoutService.getCustomerProfile(user.id);
        this.checkoutView.showForm(user, profile);
        this.updateSummary();
        this.showMessage("Vui lòng kiểm tra thông tin và xác nhận đơn hàng.");
    }

    async submitOrder(event) {
        event.preventDefault();

        const cart = this.getCart();
        if (cart.length === 0) {
            this.showMessage("Giỏ hàng đang trống. Hãy chọn lại sản phẩm.", true);
            return;
        }

        let currentUser;
        try {
            currentUser = await this.checkoutService.getCurrentUser();
        } catch {
            currentUser = null;
        }

        if (!currentUser) {
            this.showMessage("Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.", true);
            return;
        }

        const formData = new FormData(this.checkoutForm);
        const fulfillmentMethod = String(formData.get("fulfillmentMethod") || "pickup");
        const paymentMethod = "qr";
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = ValidationUtils.normalizeVietnamPhone(formData.get("phone"));
        const address = String(formData.get("address") || "").trim();

        const fieldErrors = {};
        if (fullName.length < 2) {
            fieldErrors.fullName = "Vui lòng nhập đầy đủ họ và tên người nhận.";
        }
        if (!phone || !ValidationUtils.isValidVietnamPhone(phone)) {
            fieldErrors.phone = "Số điện thoại chưa hợp lệ. Hãy nhập số di động Việt Nam gồm 10 chữ số hoặc dạng +84.";
        }
        if (!address) {
            fieldErrors.address = "Vui lòng nhập địa chỉ.";
        } else if (fulfillmentMethod === "delivery" && address.length < 20) {
            fieldErrors.address = "Địa chỉ giao hàng chưa đầy đủ. Nhập số nhà/đường hoặc thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố.";
        }

        if (Object.keys(fieldErrors).length) {
            ValidationUI.showErrors(this.checkoutForm, fieldErrors);
            this.showMessage("");
            return;
        }

        ValidationUI.clearErrors(this.checkoutForm);
        const items = cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
        }));
        const itemValidation = OrderValidator.validateItems(items);

        if (!itemValidation.isValid) {
            this.showMessage(itemValidation.errors.items, true);
            return;
        }

        this.checkoutView.setSubmitting(true);
        this.showMessage("Đang gửi đơn hàng lên hệ thống...");

        try {
            const order = await this.checkoutService.createOrder({
                fullName,
                phone,
                address,
                paymentMethod,
                fulfillmentMethod,
                items
            });

            this.cartService.clear();
            this.onCartChanged();
            this.checkoutView.resetForm();
            this.checkoutView.hideForm();
            this.updateSummary();
            this.showMessage("");

            let qrInfo;
            try {
                qrInfo = await this.checkoutService.createQrInfo(order.order_id, window.location.href);
            } catch (qrError) {
                const message = `Đơn ${order.order_code} đã được tạo nhưng chưa tạo được mã QR. Không đặt lại đơn; vui lòng vào Đơn hàng của tôi để tạo lại mã. ${qrError.message || ""}`;
                this.showMenuStatus(message, true);
                showOrderSuccessPopup(
                    { ...order, delivery_fee: fulfillmentMethod === "delivery" ? 15000 : 0 },
                    paymentMethod,
                    fulfillmentMethod,
                    { error: message },
                    this.currencyFormatter
                );
                return;
            }

            this.showMenuStatus(`Đã tạo đơn ${order.order_code}. Vui lòng thanh toán QR trong 10 phút.`);
            showOrderSuccessPopup(
                { ...order, delivery_fee: fulfillmentMethod === "delivery" ? 15000 : 0 },
                paymentMethod,
                fulfillmentMethod,
                qrInfo,
                this.currencyFormatter
            );
            this.paymentMonitor.start(order.order_id);
        } catch (error) {
            console.error("Lỗi đặt hàng ONCafe:", error);
            this.showMessage(error.message || "Không thể tạo đơn hàng. Vui lòng thử lại.", true);
        } finally {
            this.checkoutView.setSubmitting(false);
        }
    }
}
