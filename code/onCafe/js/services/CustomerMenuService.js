export class CustomerMenuService {
    constructor(repository) {
        if (!repository) throw new Error("CustomerMenuService cần CustomerMenuRepository.");
        this.repository = repository;
    }

    async getAvailableProducts() {
        return this.repository.getAvailableProducts();
    }
}
