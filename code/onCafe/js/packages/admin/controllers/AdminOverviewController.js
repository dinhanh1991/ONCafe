export function createAdminOverviewLoaders({
    dashboardPanel,
    popularPanel,
    orderService,
    revenueReportService
}) {
    async function loadPopularDrinks() {
        const chart = popularPanel.querySelector("[data-popular-drinks]");
        if (!chart) return;

        chart.replaceChildren();
        const loading = document.createElement("p");
        loading.setAttribute("role", "status");
        loading.textContent = "Đang tải dữ liệu đồ uống bán chạy...";
        chart.append(loading);

        try {
            const orders = await orderService.getStaffOrders();
            const completedOrders = orders.filter((order) => order.status === "completed");
            const salesByProduct = new Map();

            for (const order of completedOrders) {
                for (const item of Array.isArray(order.items) ? order.items : []) {
                    const name = String(item.product_name || "Đồ uống không tên").trim();
                    const quantity = Number(item.quantity);
                    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;

                    const unitPrice = Number(item.unit_price) || 0;
                    const subtotal = Number(item.subtotal);
                    const revenue = Number.isFinite(subtotal) && subtotal >= 0
                        ? subtotal
                        : unitPrice * quantity;
                    const current = salesByProduct.get(name) || { quantity: 0, revenue: 0 };
                    current.quantity += quantity;
                    current.revenue += revenue;
                    salesByProduct.set(name, current);
                }
            }

            const products = [...salesByProduct.entries()]
                .sort((first, second) =>
                    second[1].quantity - first[1].quantity ||
                    second[1].revenue - first[1].revenue ||
                    first[0].localeCompare(second[0], "vi")
                )
                .slice(0, 10);
            const totalUnits = [...salesByProduct.values()]
                .reduce((total, product) => total + product.quantity, 0);

            popularPanel.querySelector("[data-popular-order-count]").textContent = String(completedOrders.length);
            popularPanel.querySelector("[data-popular-units]").textContent = String(totalUnits);
            popularPanel.querySelector("[data-popular-product-count]").textContent = String(salesByProduct.size);

            chart.replaceChildren();
            if (!products.length) {
                const empty = document.createElement("p");
                empty.className = "seller-sales-empty";
                empty.textContent = "Chưa có đơn hàng hoàn tất có đồ uống để thống kê. Khi đơn hàng được chuyển sang Hoàn tất, dữ liệu sẽ xuất hiện tại đây.";
                chart.append(empty);
                return;
            }

            const maxQuantity = products[0][1].quantity;
            const currencyFormatter = new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0
            });

            for (const [name, sales] of products) {
                const row = document.createElement("div");
                row.className = "seller-sales-row popular-drink-row";

                const labelWrap = document.createElement("div");
                labelWrap.className = "popular-drink-label";
                const label = document.createElement("span");
                label.className = "seller-sales-name";
                label.textContent = name;
                const revenue = document.createElement("small");
                revenue.className = "popular-drink-revenue";
                revenue.textContent = currencyFormatter.format(sales.revenue);
                labelWrap.append(label, revenue);

                const track = document.createElement("div");
                track.className = "seller-sales-track";
                const bar = document.createElement("span");
                bar.style.width = `${Math.max(4, (sales.quantity / maxQuantity) * 100)}%`;
                track.append(bar);

                const value = document.createElement("strong");
                value.textContent = `${sales.quantity} ly`;
                row.append(labelWrap, track, value);
                chart.append(row);
            }
        } catch (error) {
            console.error("Không thể tải đồ uống bán chạy:", error);
            chart.replaceChildren();
            const message = document.createElement("p");
            message.className = "app-error";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải dữ liệu đồ uống bán chạy.";
            chart.append(message);
        }
    }

    async function loadCashierOverview() {
        const metricSelectors = [
            "[data-cashier-today-revenue]",
            "[data-cashier-paid-count]",
            "[data-cashier-today-count]",
            "[data-cashier-unpaid-count]",
            "[data-cashier-completed-count]",
            "[data-cashier-active-count]",
            "[data-cashier-refunded-count]"
        ];
        const metrics = metricSelectors.map((selector) => dashboardPanel.querySelector(selector));
        const comparison = dashboardPanel.querySelector("[data-cashier-revenue-comparison]");
        if (metrics.some((element) => !element) || !comparison) return;
        metrics.forEach((element) => { element.textContent = "…"; });
        comparison.textContent = "Đang so sánh doanh thu với ngày hôm qua...";

        try {
            const today = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
            }).format(new Date());
            const yesterdayDate = new Date(Date.parse(today + "T00:00:00Z") - 86400000);
            const yesterday = yesterdayDate.toISOString().slice(0, 10);
            const [orders, todayReport, yesterdayReport] = await Promise.all([
                orderService.getStaffOrders(),
                revenueReportService.getReport("day", today),
                revenueReportService.getReport("day", yesterday)
            ]);
            const todayOrders = orders.filter((order) => order.created_at &&
                new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
                }).format(new Date(order.created_at)) === today);
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
                style: "currency", currency: "VND", maximumFractionDigits: 0
            });
            const currentRevenue = Number(todayReport?.summary?.net_revenue) || 0;
            const previousRevenue = Number(yesterdayReport?.summary?.net_revenue) || 0;
            let comparisonText = "Doanh thu hôm nay bằng ngày hôm qua.";
            if (previousRevenue === 0 && currentRevenue > 0) {
                comparisonText = "Hôm nay đã phát sinh doanh thu, hôm qua chưa có doanh thu.";
            } else if (previousRevenue === 0 && currentRevenue === 0) {
                comparisonText = "Hôm nay và hôm qua chưa phát sinh doanh thu.";
            } else {
                const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
                comparisonText = `Doanh thu hôm nay ${change >= 0 ? "tăng" : "giảm"} ${Math.abs(change).toFixed(1)}% so với hôm qua (${currencyFormatter.format(previousRevenue)}).`;
            }

            metrics[0].textContent = currencyFormatter.format(currentRevenue);
            metrics[1].textContent = String(Number(todayReport?.summary?.paid_orders) || paidOrders.length);
            metrics[2].textContent = String(todayOrders.length);
            metrics[3].textContent = String(unpaidOrders.length);
            metrics[4].textContent = String(completedOrders.length);
            metrics[5].textContent = String(activeOrders.length);
            metrics[6].textContent = String(refundedOrders.length);
            comparison.textContent = comparisonText;
        } catch (error) {
            console.error("Không thể tải tổng quan thu ngân:", error);
            metrics.forEach((element) => { element.textContent = "—"; });
            comparison.textContent = error.message || "Không thể tải số liệu so sánh doanh thu.";
            comparison.classList.add("app-error");
        }
    }

    async function loadSellerOverview() {
        const chart = dashboardPanel.querySelector("[data-seller-sales-chart]");
        if (!chart) return;
        chart.replaceChildren();
        const loading = document.createElement("p");
        loading.setAttribute("role", "status");
        loading.textContent = "Đang tải thống kê bán hàng...";
        chart.append(loading);

        try {
            const orders = await orderService.getStaffOrders();
            const completedOrders = orders.filter((order) => order.status === "completed");
            const salesByProduct = new Map();
            for (const order of completedOrders) {
                for (const item of Array.isArray(order.items) ? order.items : []) {
                    const name = String(item.product_name || "Đồ uống không tên");
                    const quantity = Number(item.quantity);
                    if (!Number.isFinite(quantity) || quantity <= 0) continue;
                    salesByProduct.set(name, (salesByProduct.get(name) || 0) + quantity);
                }
            }

            const totalUnitsSold = [...salesByProduct.values()].reduce((total, quantity) => total + quantity, 0);
            dashboardPanel.querySelector("[data-seller-order-count]").textContent = String(orders.length);
            dashboardPanel.querySelector("[data-seller-completed-count]").textContent = String(completedOrders.length);
            dashboardPanel.querySelector("[data-seller-units-sold]").textContent = String(totalUnitsSold);

            const topProducts = [...salesByProduct.entries()]
                .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "vi"))
                .slice(0, 5);
            chart.replaceChildren();
            if (!topProducts.length) {
                const empty = document.createElement("p");
                empty.className = "seller-sales-empty";
                empty.textContent = "Chưa có đồ uống nào được bán trong đơn hàng hoàn tất.";
                chart.append(empty);
                return;
            }

            const maxQuantity = topProducts[0][1];
            for (const [name, quantity] of topProducts) {
                const row = document.createElement("div");
                row.className = "seller-sales-row";
                const label = document.createElement("span");
                label.className = "seller-sales-name";
                label.textContent = name;
                const track = document.createElement("div");
                track.className = "seller-sales-track";
                const bar = document.createElement("span");
                bar.style.width = `${Math.max(4, (quantity / maxQuantity) * 100)}%`;
                track.append(bar);
                const value = document.createElement("strong");
                value.textContent = String(quantity);
                row.append(label, track, value);
                chart.append(row);
            }
        } catch (error) {
            console.error("Không thể tải thống kê bán hàng:", error);
            chart.replaceChildren();
            const message = document.createElement("p");
            message.className = "app-error";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải thống kê bán hàng.";
            chart.append(message);
        }
    }
    return { loadPopularDrinks, loadCashierOverview, loadSellerOverview };
}
