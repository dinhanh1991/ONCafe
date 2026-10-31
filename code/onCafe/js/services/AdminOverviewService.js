/**
 * Tổng hợp số liệu từ đơn hàng để hiển thị trên màn hình tổng quan.
 * Không truy cập DOM hoặc Supabase.
 */
export class AdminOverviewService {
    static aggregateCompletedSales(orders = [], { trimNames = true, skipEmptyNames = true } = {}) {
        const completedOrders = orders.filter((order) => order.status === "completed");
        const salesByProduct = new Map();

        for (const order of completedOrders) {
            for (const item of Array.isArray(order.items) ? order.items : []) {
                const rawName = String(item.product_name || "Đồ uống không tên");
                const name = trimNames ? rawName.trim() : rawName;
                const quantity = Number(item.quantity);
                if ((skipEmptyNames && !name) || !Number.isFinite(quantity) || quantity <= 0) continue;

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

        return { completedOrders, salesByProduct };
    }

    static getPopularDrinks(orders = [], limit = 10) {
        const { completedOrders, salesByProduct } = this.aggregateCompletedSales(orders);
        const products = [...salesByProduct.entries()]
            .sort((first, second) =>
                second[1].quantity - first[1].quantity ||
                second[1].revenue - first[1].revenue ||
                first[0].localeCompare(second[0], "vi")
            )
            .slice(0, limit);
        const totalUnits = [...salesByProduct.values()]
            .reduce((total, product) => total + product.quantity, 0);

        return {
            completedOrderCount: completedOrders.length,
            productCount: salesByProduct.size,
            totalUnits,
            products
        };
    }

    static getSellerOverview(orders = [], limit = 5) {
        const { completedOrders, salesByProduct } = this.aggregateCompletedSales(orders, {
            trimNames: false,
            skipEmptyNames: false
        });
        const topProducts = [...salesByProduct.entries()]
            .sort((first, second) =>
                second[1].quantity - first[1].quantity ||
                first[0].localeCompare(second[0], "vi")
            )
            .slice(0, limit)
            .map(([name, sales]) => ({ name, quantity: sales.quantity }));
        const totalUnitsSold = [...salesByProduct.values()]
            .reduce((total, sales) => total + sales.quantity, 0);

        return {
            orderCount: orders.length,
            completedOrderCount: completedOrders.length,
            totalUnitsSold,
            topProducts
        };
    }
}
