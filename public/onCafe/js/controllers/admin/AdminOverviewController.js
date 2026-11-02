import { AdminOverviewService } from "../../services/AdminOverviewService.js";
import { AdminOverviewView } from "../../views/admin/DashboardView.js";

export function createAdminOverviewLoaders({
    dashboardPanel,
    popularPanel,
    orderService,
    revenueReportService,
    productService,
    employeeService
}) {
    const overviewView = new AdminOverviewView({ dashboardPanel, popularPanel });

    function getToday() {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());
    }

    function isToday(dateValue, today) {
        return dateValue && new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date(dateValue)) === today;
    }

    async function loadPopularDrinks() {
        const chart = popularPanel.querySelector("[data-popular-drinks]");
        if (!chart) return;
        overviewView.setPopularDrinksLoading();

        try {
            const orders = await orderService.getStaffOrders();
            overviewView.renderPopularDrinks(AdminOverviewService.getPopularDrinks(orders));
        } catch (error) {
            console.error("Không thể tải đồ uống bán chạy:", error);
            overviewView.renderChartError(
                chart,
                error.message || "Không thể tải dữ liệu đồ uống bán chạy."
            );
        }
    }

    async function loadAdminOverview() {
        const revenueElement = dashboardPanel.querySelector("[data-admin-today-revenue]");
        const ordersElement = dashboardPanel.querySelector("[data-admin-today-orders]");
        const productsElement = dashboardPanel.querySelector("[data-admin-active-products]");
        const employeesElement = dashboardPanel.querySelector("[data-admin-employee-count]");
        const refreshButton = dashboardPanel.querySelector("[data-admin-overview-refresh]");
        if (!revenueElement || !ordersElement || !productsElement || !employeesElement) return;

        const load = async () => {
            overviewView.setAdminOverviewLoading();
            if (refreshButton) refreshButton.disabled = true;

            try {
                const today = getToday();
                const [reportResult, ordersResult, productsResult, employeesResult] = await Promise.allSettled([
                    revenueReportService.getReport("day", today),
                    orderService.getStaffOrders(),
                    productService.getAllProducts(),
                    employeeService.listEmployees()
                ]);

                const revenue = reportResult.status === "fulfilled"
                    ? new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0
                    }).format(Number(reportResult.value?.summary?.net_revenue) || 0)
                    : "Không tải được";

                const orders = ordersResult.status === "fulfilled"
                    ? ordersResult.value.filter((order) => isToday(order.created_at, today)).length
                    : "—";
                const products = productsResult.status === "fulfilled"
                    ? productsResult.value.filter((product) => product.status === "active").length
                    : "—";
                const employees = employeesResult.status === "fulfilled"
                    ? employeesResult.value.length
                    : "—";

                if (reportResult.status === "rejected") {
                    console.error("Không thể tải doanh thu tổng quan Admin:", reportResult.reason);
                }
                if (ordersResult.status === "rejected") {
                    console.error("Không thể tải số đơn hàng tổng quan Admin:", ordersResult.reason);
                }
                if (productsResult.status === "rejected") {
                    console.error("Không thể tải số sản phẩm tổng quan Admin:", productsResult.reason);
                }
                if (employeesResult.status === "rejected") {
                    console.error("Không thể tải số nhân viên tổng quan Admin:", employeesResult.reason);
                }

                overviewView.renderAdminOverview({ revenue, orders, products, employees });
            } catch (error) {
                console.error("Không thể tải tổng quan Admin:", error);
                overviewView.renderAdminOverviewError();
            } finally {
                if (refreshButton) refreshButton.disabled = false;
            }
        };

        if (refreshButton && !refreshButton.dataset.bound) {
            refreshButton.dataset.bound = "true";
            refreshButton.addEventListener("click", () => {
                void load();
            });
        }

        await load();
    }

    async function loadCashierOverview() {
        overviewView.setCashierOverviewLoading();

        try {
            const today = getToday();
            const yesterdayDate = new Date(Date.parse(today + "T00:00:00Z") - 86400000);
            const yesterday = yesterdayDate.toISOString().slice(0, 10);
            const [orders, todayReport, yesterdayReport] = await Promise.all([
                orderService.getStaffOrders(),
                revenueReportService.getReport("day", today),
                revenueReportService.getReport("day", yesterday)
            ]);

            const todayOrders = orders.filter((order) => isToday(order.created_at, today));
            const paidOrders = todayOrders.filter((order) => order.payment_status === "paid");
            const unpaidOrders = todayOrders.filter((order) =>
                order.payment_status === "unpaid" && !["cancelled", "rejected"].includes(order.status)
            );
            const completedOrders = todayOrders.filter((order) => order.status === "completed");
            const activeOrders = todayOrders.filter((order) =>
                ["confirmed", "preparing", "ready_for_pickup", "delivering"].includes(order.status)
            );
            const refundedOrders = todayOrders.filter((order) => order.payment_status === "refunded");
            const currencyFormatter = new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0
            });
            const currentRevenue = Number(todayReport?.summary?.net_revenue) || 0;
            const previousRevenue = Number(yesterdayReport?.summary?.net_revenue) || 0;
            let comparison = "Doanh thu hôm nay bằng ngày hôm qua.";

            if (previousRevenue === 0 && currentRevenue > 0) {
                comparison = "Hôm nay đã phát sinh doanh thu, hôm qua chưa có doanh thu.";
            } else if (previousRevenue === 0 && currentRevenue === 0) {
                comparison = "Hôm nay và hôm qua chưa phát sinh doanh thu.";
            } else {
                const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
                comparison = `Doanh thu hôm nay ${change >= 0 ? "tăng" : "giảm"} ${Math.abs(change).toFixed(1)}% so với hôm qua (${currencyFormatter.format(previousRevenue)}).`;
            }

            overviewView.renderCashierOverview({
                revenue: currencyFormatter.format(currentRevenue),
                paid: Number(todayReport?.summary?.paid_orders) || paidOrders.length,
                today: todayOrders.length,
                unpaid: unpaidOrders.length,
                completed: completedOrders.length,
                active: activeOrders.length,
                refunded: refundedOrders.length,
                comparison
            });
        } catch (error) {
            console.error("Không thể tải tổng quan thu ngân:", error);
            overviewView.renderCashierOverviewError(
                error.message || "Không thể tải số liệu so sánh doanh thu."
            );
        }
    }

    async function loadSellerOverview() {
        const chart = dashboardPanel.querySelector("[data-seller-sales-chart]");
        if (!chart) return;
        overviewView.setSellerOverviewLoading();

        try {
            const orders = await orderService.getStaffOrders();
            overviewView.renderSellerOverview(AdminOverviewService.getSellerOverview(orders));
        } catch (error) {
            console.error("Không thể tải thống kê bán hàng:", error);
            overviewView.renderChartError(
                chart,
                error.message || "Không thể tải thống kê bán hàng."
            );
        }
    }

    return { loadPopularDrinks, loadAdminOverview, loadCashierOverview, loadSellerOverview };
}
