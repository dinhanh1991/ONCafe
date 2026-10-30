import { supabase } from "../config/supabase.js";

const PRODUCT_SELECT = "id, name, price, quantity, image_url, is_available, category_id, categories(name)";

function mapProduct(row) {
    return {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        category: row.categories?.name ?? "",
        quantity: Number(row.quantity ?? 0),
        imageUrl: row.image_url ?? "",
        status: row.is_available ? "active" : "inactive"
    };
}

function throwIfError(error) {
    if (error) throw error;
}

function createUniqueId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class ProductRepository {
    async findAll() {
        const { data, error } = await supabase
            .from("products")
            .select(PRODUCT_SELECT)
            .order("id", { ascending: true });

        throwIfError(error);
        return (data ?? []).map(mapProduct);
    }

    async findById(id) {
        const normalizedId = Number(id);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) return null;

        const { data, error } = await supabase
            .from("products")
            .select(PRODUCT_SELECT)
            .eq("id", normalizedId)
            .maybeSingle();

        throwIfError(error);
        return data ? mapProduct(data) : null;
    }

    async save(product) {
        const categoryId = await this.getOrCreateCategory(product.category);
        const { data, error } = await supabase
            .from("products")
            .insert({
                name: product.name,
                price: Number(product.price),
                category_id: categoryId,
                quantity: Number(product.quantity),
                image_url: product.imageUrl || null,
                is_available: product.status !== "inactive"
            })
            .select(PRODUCT_SELECT)
            .single();

        throwIfError(error);
        return mapProduct(data);
    }

    async update(id, updatedData) {
        const normalizedId = Number(id);
        const categoryId = await this.getOrCreateCategory(updatedData.category);
        const { data, error } = await supabase
            .from("products")
            .update({
                name: updatedData.name,
                price: Number(updatedData.price),
                category_id: categoryId,
                quantity: Number(updatedData.quantity),
                image_url: updatedData.imageUrl || null,
                is_available: updatedData.status !== "inactive"
            })
            .eq("id", normalizedId)
            .select(PRODUCT_SELECT)
            .single();

        throwIfError(error);
        return mapProduct(data);
    }

    async delete(id) {
        const normalizedId = Number(id);
        const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", normalizedId);

        throwIfError(error);
        return true;
    }

    async uploadImage(file) {
        if (!(file instanceof File)) {
            throw new Error("Vui lòng chọn ảnh sản phẩm từ máy tính.");
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            throw new Error("Ảnh phải có định dạng JPG, PNG, WEBP hoặc GIF.");
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error("Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.");
        }

        const extensionByType = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        };
        const extension = extensionByType[file.type];
        const filePath = `products/${Date.now()}-${createUniqueId()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        throwIfError(uploadError);

        const { data } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    async getOrCreateCategory(name) {
        const normalizedName = String(name ?? "").trim();
        if (!normalizedName) {
            throw new Error("Vui lòng nhập danh mục sản phẩm.");
        }

        const { data, error } = await supabase
            .from("categories")
            .upsert({ name: normalizedName }, { onConflict: "name" })
            .select("id")
            .single();

        throwIfError(error);
        return data.id;
    }
}
