import { supabase } from "./config/supabase.js";

const menuGrid = document.querySelector("#menuGrid");
const menuStatus = document.querySelector("#menuStatus");
const currencyFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
});

function showStatus(message, isError = false) {
    if (!menuStatus) return;
    menuStatus.textContent = message;
    menuStatus.classList.toggle("menu-status-error", isError);
    menuStatus.hidden = false;
}

function createMenuCard(product) {
    const card = document.createElement("article");
    card.className = "menu-card";

    const image = document.createElement("img");
    image.src = product.image_url || "../assets/images/bac-xiu.jpg";
    image.alt = product.name ? `Ảnh ${product.name}` : "Ảnh đồ uống";
    image.loading = "lazy";
    image.addEventListener("error", () => {
        image.src = "../assets/images/bac-xiu.jpg";
    }, { once: true });

    const content = document.createElement("div");
    content.className = "menu-card-content";

    const category = document.createElement("p");
    category.className = "menu-card-category";
    category.textContent = product.categories?.name || "Đồ uống";

    const name = document.createElement("h2");
    name.textContent = product.name || "Sản phẩm";

    const price = document.createElement("p");
    price.className = "menu-card-price";
    price.textContent = currencyFormatter.format(Number(product.price) || 0);

    content.append(category, name, price);
    card.append(image, content);
    return card;
}

async function loadMenu() {
    if (!menuGrid) return;

    showStatus("Đang tải thực đơn...");
    menuGrid.replaceChildren();

    const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, is_available, categories(name)")
        .eq("is_available", true)
        .order("name", { ascending: true });

    if (error) {
        console.error("Không thể tải thực đơn ONCafe:", error);
        showStatus(
            "Chưa tải được thực đơn. Vui lòng thử tải lại trang. Nếu lỗi vẫn còn, cần kiểm tra quyền đọc bảng products trong Supabase (RLS).",
            true
        );
        return;
    }

    if (!data || data.length === 0) {
        showStatus("Hiện chưa có đồ uống nào được mở bán.");
        return;
    }

    const cards = data.map(createMenuCard);
    menuGrid.append(...cards);
    menuStatus.hidden = true;
}

loadMenu();
