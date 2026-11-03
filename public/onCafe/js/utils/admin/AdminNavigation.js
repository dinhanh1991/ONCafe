// Ánh xạ trang quản trị và kiểm tra quyền truy cập từng khu vực.
const PAGE_FILES = {
    overview: "dashboard",
    drinks: "products",
    employees: "employees",
    "counter-order": "counter-sales",
    orders: "orders",
    "revenue-summary": "revenue-summary",
    revenue: "revenue",
    popular: "popular",
    "my-profile": "profile"
};

// Kiểm tra vai trò có quyền truy cập khu vực quản trị hay không.
export function isSectionAllowed(role, sectionName) {
    const isAdmin = role === "admin";
    const isSeller = role === "seller";
    const isCashier = role === "cashier";
    const isStaff = isAdmin || isSeller || isCashier;

    const permissions = {
        overview: isStaff,
        drinks: isAdmin || isSeller,
        employees: isAdmin,
        "counter-order": isAdmin || isSeller,
        orders: isStaff,
        "revenue-summary": isAdmin || isCashier,
        revenue: isAdmin || isCashier,
        popular: isAdmin || isSeller,
        "my-profile": isStaff
    };

    return permissions[sectionName] === true;
}

// Tạo đường dẫn đến trang quản trị theo khu vực.
export function getAdminPageUrl(sectionName, currentPath = window.location.pathname) {
    const file = PAGE_FILES[sectionName];
    if (!file) return null;

    return currentPath.includes("/pages/admin/")
        ? `./${file}.html`
        : `./pages/admin/${file}.html`;
}
